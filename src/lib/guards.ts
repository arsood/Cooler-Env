import fs from "fs";

import { Paths } from "./types";
import { CoolerEnvError } from "./errors";
import { DANGEROUS_KEYS } from "./constants";

/** Ensure an environment has been initialized before reading/mutating it. */
export const assertInitialized = (paths: Paths, env: string): void => {
  if (!fs.existsSync(paths.keyFile)) {
    throw new CoolerEnvError(
      `Encryption key not found for environment "${env}". Run \`cooler-env init -e ${env}\` first.`,
    );
  }

  if (!fs.existsSync(paths.encryptedFile)) {
    throw new CoolerEnvError(
      `Encrypted file not found for environment "${env}". Run \`cooler-env init -e ${env}\` first.`,
    );
  }
};

// A valid environment-variable name: a letter or underscore, then letters,
// digits, or underscores. Keeps stored keys usable as real env vars once
// injected into `process.env`.
const KEY_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** inquirer validator: non-empty, trimmed, and safe to store as a key name. */
export const validateKeyName = (value: string): true | string => {
  const trimmed = value.trim();

  if (!trimmed.length) return "Please enter a non-empty key name.";
  if (DANGEROUS_KEYS.has(trimmed)) return `"${trimmed}" is a reserved name.`;
  if (!KEY_NAME_PATTERN.test(trimmed)) {
    return "Key names must start with a letter or underscore and contain only letters, digits, and underscores (e.g. API_KEY).";
  }

  return true;
};
