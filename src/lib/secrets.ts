import fs from "fs";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";

import { Paths, Secrets } from "./types";
import { CoolerEnvError } from "./errors";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// Authenticated encryption. The on-disk format is a single binary blob with a
// versioned header so the KDF/cipher parameters can evolve without guesswork:
//
//   [ magic "CENV" (4) ][ version (1) ][ salt (16) ][ iv (12) ][ authTag (16) ][ ciphertext ... ]
//
// A fresh random salt + IV is generated on every write, the key is derived
// from the secret key via scrypt, and GCM's auth tag makes tampering (or a
// wrong key) fail loudly instead of yielding garbage.
//
// Blobs written by v3 have no magic prefix — just the salt/iv/tag/ciphertext
// body — and are still read: a missing magic is treated as format version 0.
const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const BODY_HEADER_LENGTH = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;

// 4-byte magic + 1 version byte. New writes use version 1; the collision odds
// of a v3 salt happening to start with these exact 4 bytes are 1 in 2^32.
const MAGIC = Buffer.from("CENV", "ascii");
const FORMAT_VERSION = 1;
const VERSION_HEADER_LENGTH = MAGIC.length + 1;

// Keys that would let a decrypted payload poison Object.prototype if it were
// ever spread onto another object (e.g. process.env). Never round-trip these.
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const deriveKey = (password: string, salt: Buffer): Promise<Buffer> =>
  scrypt(password, salt, KEY_LENGTH);

const readKey = async (paths: Paths): Promise<string> => {
  try {
    return (await fs.promises.readFile(paths.keyFile)).toString().trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CoolerEnvError(`Encryption key not found at ${paths.keyFile}.`);
    }
    throw err;
  }
};

/** Strip prototype-polluting keys and coerce values to strings. */
const sanitize = (raw: Record<string, unknown>): Secrets => {
  const clean: Secrets = {};

  for (const [key, value] of Object.entries(raw)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    clean[key] = String(value);
  }

  return clean;
};

/** Encrypt a secrets object into the on-disk blob format. */
export const encryptSecrets = async (
  secrets: Secrets,
  password: string,
): Promise<Buffer> => {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(secrets), "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([
    MAGIC,
    Buffer.from([FORMAT_VERSION]),
    salt,
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);
};

/** Decrypt an on-disk blob back into a sanitized secrets object. */
export const decryptSecrets = async (
  blob: Buffer,
  password: string,
): Promise<Secrets> => {
  // A magic prefix means a versioned blob; without it, treat the whole blob as
  // a v3 (version 0) body for backward compatibility.
  let offset = 0;
  if (
    blob.length >= MAGIC.length &&
    blob.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    const version = blob[MAGIC.length];
    if (version !== FORMAT_VERSION) {
      throw new CoolerEnvError(
        `Unsupported encrypted file format version ${version}. Upgrade cooler-env to read this file.`,
      );
    }
    offset = VERSION_HEADER_LENGTH;
  }

  if (blob.length < offset + BODY_HEADER_LENGTH) {
    throw new CoolerEnvError("The encrypted file is truncated or corrupt.");
  }

  const saltStart = offset;
  const ivStart = saltStart + SALT_LENGTH;
  const authTagStart = ivStart + IV_LENGTH;
  const ciphertextStart = authTagStart + AUTH_TAG_LENGTH;

  const salt = blob.subarray(saltStart, ivStart);
  const iv = blob.subarray(ivStart, authTagStart);
  const authTag = blob.subarray(authTagStart, ciphertextStart);
  const ciphertext = blob.subarray(ciphertextStart);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    await deriveKey(password, salt),
    iv,
  );
  decipher.setAuthTag(authTag);

  let plaintext: string;
  try {
    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new CoolerEnvError(
      "Could not decrypt secrets — the key is wrong or the file has been tampered with.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new CoolerEnvError(
      "Could not read secrets — decrypted content is not valid JSON.",
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CoolerEnvError(
      "Could not read secrets — decrypted content is not a key/value object.",
    );
  }

  return sanitize(parsed as Record<string, unknown>);
};

/** Decrypt the environment's encrypted file into a plain object. */
export const readSecrets = async (paths: Paths): Promise<Secrets> => {
  const password = await readKey(paths);

  let blob: Buffer;
  try {
    blob = await fs.promises.readFile(paths.encryptedFile);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CoolerEnvError(
        `Encrypted file not found at ${paths.encryptedFile}.`,
      );
    }
    throw err;
  }

  return decryptSecrets(blob, password);
};

/**
 * Encrypt `secrets` and atomically replace the environment's encrypted file.
 *
 * Ciphertext is produced in memory and written to a uniquely-named temp file
 * that is renamed over the target, so plaintext never touches disk and an
 * interrupted run cannot leave a half-written file.
 */
export const writeSecrets = async (
  paths: Paths,
  secrets: Secrets,
): Promise<void> => {
  const blob = await encryptSecrets(secrets, await readKey(paths));
  const staging = path.join(
    paths.configDir,
    `.coolerenv-${process.pid}-${crypto.randomBytes(6).toString("hex")}.tmp`,
  );

  try {
    fs.writeFileSync(staging, blob, { mode: 0o600 });
    fs.renameSync(staging, paths.encryptedFile);
  } finally {
    if (fs.existsSync(staging)) fs.unlinkSync(staging);
  }
};
