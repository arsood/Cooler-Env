import fs from "fs";

import { Paths } from "./types";
import { CoolerEnvError } from "./errors";

/** Ensure an environment has been initialized before reading/mutating it. */
export const assertInitialized = (paths: Paths, env: string): void => {
  if (!fs.existsSync(paths.keyFile)) {
    throw new CoolerEnvError(
      `Encryption key not found for environment "${env}". Run \`cooler-env init -e ${env}\` first.`
    );
  }

  if (!fs.existsSync(paths.encryptedFile)) {
    throw new CoolerEnvError(
      `Encrypted file not found for environment "${env}". Run \`cooler-env init -e ${env}\` first.`
    );
  }
};

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** inquirer validator: non-empty, trimmed, and safe to store as a key name. */
export const validateKeyName = (value: string): true | string => {
  const trimmed = value.trim();

  if (!trimmed.length) return "Please enter a non-empty key name.";
  if (DANGEROUS_KEYS.has(trimmed)) return `"${trimmed}" is a reserved name.`;

  return true;
};

/** inquirer validator: non-empty value. */
export const validateValue = (value: string): true | string =>
  value.length ? true : "Please enter a value.";
