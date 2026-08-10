import fs from "fs";

import { Secrets } from "./lib/types";
import { resolvePaths } from "./lib/paths";
import { readSecrets } from "./lib/secrets";

/**
 * Decrypt the given environment's secrets, load each into `process.env`, and
 * return them. Call (and await) this before reading any managed variable.
 *
 * @param env        The environment name, e.g. `process.env.NODE_ENV`.
 * @param configPath Directory holding the key/encrypted files. Defaults to `config`.
 */
export const loadEnv = async (
  env: string,
  configPath?: string
): Promise<Secrets> => {
  if (!env) {
    throw new Error(
      "Cooler-Env: loadEnv requires a valid environment name to be passed as an argument"
    );
  }

  const paths = resolvePaths(env, configPath);

  if (!fs.existsSync(paths.keyFile)) {
    throw new Error(
      `Cooler-Env: Encryption key not found for environment "${env}"`
    );
  }

  if (!fs.existsSync(paths.encryptedFile)) {
    throw new Error(
      `Cooler-Env: Encrypted file not found for environment "${env}"`
    );
  }

  const secrets = await readSecrets(paths);

  for (const [key, value] of Object.entries(secrets)) {
    process.env[key] = value;
  }

  return secrets;
};
