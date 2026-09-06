import fs from "fs";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";

import { Paths, Secrets } from "./types";
import { CoolerEnvError } from "./errors";
import { DANGEROUS_KEYS } from "./constants";

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

/** The versioned header (magic + version byte) prepended to every new blob. */
const currentHeader = (): Buffer =>
  Buffer.concat([MAGIC, Buffer.from([FORMAT_VERSION])]);

/** Encrypt a secrets object into the on-disk blob format. */
export const encryptSecrets = async (
  secrets: Secrets,
  password: string,
): Promise<Buffer> => {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt);
  const header = currentHeader();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  // Bind the header into the auth tag, so the version byte can't be flipped or
  // the magic stripped without decryption failing.
  cipher.setAAD(header);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(secrets), "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([header, salt, iv, cipher.getAuthTag(), ciphertext]);
};

/**
 * Decrypt one blob body located at `offset` (0 for a headerless v3 body). When
 * `aad` is given it is bound into the GCM auth tag, so it must match what was
 * used at encryption time or `final()` throws.
 */
const decodeBody = async (
  blob: Buffer,
  offset: number,
  aad: Buffer | undefined,
  password: string,
): Promise<Secrets> => {
  if (blob.length < offset + BODY_HEADER_LENGTH) {
    throw new CoolerEnvError("The encrypted file is truncated or corrupt.");
  }

  const ivStart = offset + SALT_LENGTH;
  const authTagStart = ivStart + IV_LENGTH;
  const ciphertextStart = authTagStart + AUTH_TAG_LENGTH;

  const salt = blob.subarray(offset, ivStart);
  const iv = blob.subarray(ivStart, authTagStart);
  const authTag = blob.subarray(authTagStart, ciphertextStart);
  const ciphertext = blob.subarray(ciphertextStart);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    await deriveKey(password, salt),
    iv,
  );
  if (aad) decipher.setAAD(aad);
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

/** Decrypt an on-disk blob back into a sanitized secrets object. */
export const decryptSecrets = async (
  blob: Buffer,
  password: string,
): Promise<Secrets> => {
  // No magic prefix → a v3 (headerless) body, read for backward compatibility.
  // The length guard also keeps a short blob (e.g. exactly "CENV") out of the
  // version read below, so it reports "truncated" rather than a bogus version.
  const hasMagic =
    blob.length >= VERSION_HEADER_LENGTH &&
    blob.subarray(0, MAGIC.length).equals(MAGIC);

  if (!hasMagic) {
    return decodeBody(blob, 0, undefined, password);
  }

  const version = blob[MAGIC.length];
  const header = blob.subarray(0, VERSION_HEADER_LENGTH);

  if (version === FORMAT_VERSION) {
    try {
      return await decodeBody(blob, VERSION_HEADER_LENGTH, header, password);
    } catch (err) {
      // A real v4 blob that failed to authenticate (wrong key or tampering)
      // lands here — but so would the ~1-in-2^32 case where a v3 blob's random
      // salt happened to start with the magic bytes. Try a headerless read;
      // if that also fails, the file really was a bad v4 blob, so re-surface
      // the original error.
      try {
        return await decodeBody(blob, 0, undefined, password);
      } catch {
        throw err;
      }
    }
  }

  // Unknown version: a future format we can't read, or the same rare v3 magic
  // collision. Attempt a headerless read before declaring the file unreadable.
  try {
    return await decodeBody(blob, 0, undefined, password);
  } catch {
    throw new CoolerEnvError(
      `Unsupported encrypted file format version ${version}. Upgrade cooler-env to read this file.`,
    );
  }
};

/**
 * Decrypt the environment's encrypted file, returning both the secrets and the
 * key that unlocked them so a follow-up `writeSecrets` can reuse it instead of
 * reading the key file a second time.
 */
export const readSecretsWithKey = async (
  paths: Paths,
): Promise<{ secrets: Secrets; password: string }> => {
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

  return { secrets: await decryptSecrets(blob, password), password };
};

/** Decrypt the environment's encrypted file into a plain object. */
export const readSecrets = async (paths: Paths): Promise<Secrets> =>
  (await readSecretsWithKey(paths)).secrets;

/**
 * Encrypt `secrets` and atomically replace the environment's encrypted file.
 *
 * Ciphertext is produced in memory and written to a uniquely-named temp file
 * that is renamed over the target, so plaintext never touches disk and an
 * interrupted run cannot leave a half-written file. Pass `password` to reuse a
 * key already read this run (e.g. from `readSecretsWithKey`); otherwise the key
 * file is read here.
 */
export const writeSecrets = async (
  paths: Paths,
  secrets: Secrets,
  password?: string,
): Promise<void> => {
  const blob = await encryptSecrets(
    secrets,
    password ?? (await readKey(paths)),
  );
  const staging = path.join(
    paths.configDir,
    `.coolerenv-${process.pid}-${crypto.randomBytes(6).toString("hex")}.tmp`,
  );

  try {
    await fs.promises.writeFile(staging, blob, { mode: 0o600 });
    await fs.promises.rename(staging, paths.encryptedFile);
  } finally {
    await fs.promises.rm(staging, { force: true });
  }
};
