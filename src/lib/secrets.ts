import fs from "fs";
import path from "path";
import crypto from "crypto";
import Cryptify from "cryptify";

import { Paths, Secrets } from "./types";
import { CoolerEnvError } from "./errors";

// Keys that would let a decrypted payload poison Object.prototype if it were
// ever spread onto another object (e.g. process.env). Never round-trip these.
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Wrap cryptify's positional constructor. The 5th and 6th args are `silent`
 * and `loose`: `loose` is REQUIRED because our random hex key does not satisfy
 * cryptify's human-password complexity rules, and `silent` suppresses its
 * stdout logging. Cipher/encoding are left at cryptify's defaults (aes-256-cbc)
 * so existing .yml.enc files stay readable.
 */
const createCipher = (filePath: string, key: string): Cryptify =>
  new Cryptify(filePath, key, undefined, undefined, true, true);

/** A unique, same-directory temp path so concurrent runs never collide. */
const tempPath = (dir: string, label: string): string =>
  path.join(
    dir,
    `.coolerenv-${label}-${process.pid}-${crypto
      .randomBytes(6)
      .toString("hex")}.tmp`
  );

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

/**
 * Decrypt the environment's .yml.enc into a plain object.
 *
 * Decryption happens on a throwaway copy that is always removed, so a crash
 * never leaves plaintext behind and parallel reads don't clobber each other.
 */
export const readSecrets = async (paths: Paths): Promise<Secrets> => {
  const workingCopy = tempPath(paths.configDir, "read");
  fs.copyFileSync(paths.encryptedFile, workingCopy);

  try {
    const files = await createCipher(workingCopy, readKey(paths)).decrypt();

    if (!files || !files[0]) return {};

    let parsed: unknown;
    try {
      parsed = JSON.parse(files[0]);
    } catch {
      throw new CoolerEnvError(
        "Could not read secrets — the encrypted file is corrupt or the key is wrong."
      );
    }

    return sanitize(parsed as Record<string, unknown>);
  } finally {
    if (fs.existsSync(workingCopy)) fs.unlinkSync(workingCopy);
  }
};

/**
 * Encrypt `secrets` and atomically replace the environment's .yml.enc.
 *
 * Plaintext is written only to a temp file that is encrypted in place and then
 * renamed over the target, so the committed .yml.enc is never plaintext — even
 * momentarily — and an interrupted run cannot leave secrets on disk.
 */
export const writeSecrets = async (
  paths: Paths,
  secrets: Secrets
): Promise<void> => {
  const staging = tempPath(paths.configDir, "write");
  fs.writeFileSync(staging, JSON.stringify(secrets), { mode: 0o600 });

  try {
    await createCipher(staging, readKey(paths)).encrypt();
    fs.renameSync(staging, paths.encryptedFile);
  } finally {
    if (fs.existsSync(staging)) fs.unlinkSync(staging);
  }
};
