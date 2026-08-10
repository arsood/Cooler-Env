import fs from "fs";
import path from "path";
import crypto from "crypto";

import { Paths, Secrets } from "./types";
import { CoolerEnvError } from "./errors";

// Authenticated encryption. The on-disk format is a single binary blob:
//
//   [ salt (16) ][ iv (12) ][ authTag (16) ][ ciphertext ... ]
//
// A fresh random salt + IV is generated on every write, the key is derived
// from the secret key via scrypt, and GCM's auth tag makes tampering (or a
// wrong key) fail loudly instead of yielding garbage.
const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const HEADER_LENGTH = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;

// Keys that would let a decrypted payload poison Object.prototype if it were
// ever spread onto another object (e.g. process.env). Never round-trip these.
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const deriveKey = (password: string, salt: Buffer): Buffer =>
  crypto.scryptSync(password, salt, KEY_LENGTH);

const readKey = (paths: Paths): string =>
  fs.readFileSync(paths.keyFile).toString().trim();

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
export const encryptSecrets = (secrets: Secrets, password: string): Buffer => {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(secrets), "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([salt, iv, cipher.getAuthTag(), ciphertext]);
};

/** Decrypt an on-disk blob back into a sanitized secrets object. */
export const decryptSecrets = (blob: Buffer, password: string): Secrets => {
  if (blob.length < HEADER_LENGTH) {
    throw new CoolerEnvError("The encrypted file is truncated or corrupt.");
  }

  const salt = blob.subarray(0, SALT_LENGTH);
  const iv = blob.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = blob.subarray(SALT_LENGTH + IV_LENGTH, HEADER_LENGTH);
  const ciphertext = blob.subarray(HEADER_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(password, salt), iv);
  decipher.setAuthTag(authTag);

  let plaintext: string;
  try {
    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new CoolerEnvError(
      "Could not decrypt secrets — the key is wrong or the file has been tampered with."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new CoolerEnvError(
      "Could not read secrets — decrypted content is not valid JSON."
    );
  }

  return sanitize(parsed as Record<string, unknown>);
};

/** Decrypt the environment's encrypted file into a plain object. */
export const readSecrets = async (paths: Paths): Promise<Secrets> =>
  decryptSecrets(fs.readFileSync(paths.encryptedFile), readKey(paths));

/**
 * Encrypt `secrets` and atomically replace the environment's encrypted file.
 *
 * Ciphertext is produced in memory and written to a uniquely-named temp file
 * that is renamed over the target, so plaintext never touches disk and an
 * interrupted run cannot leave a half-written file.
 */
export const writeSecrets = async (
  paths: Paths,
  secrets: Secrets
): Promise<void> => {
  const blob = encryptSecrets(secrets, readKey(paths));
  const staging = path.join(
    paths.configDir,
    `.coolerenv-${process.pid}-${crypto.randomBytes(6).toString("hex")}.tmp`
  );

  try {
    fs.writeFileSync(staging, blob, { mode: 0o600 });
    fs.renameSync(staging, paths.encryptedFile);
  } finally {
    if (fs.existsSync(staging)) fs.unlinkSync(staging);
  }
};
