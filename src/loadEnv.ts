import { Secrets } from "./lib/types";
import { resolvePaths } from "./lib/paths";
import { readSecrets } from "./lib/secrets";
import { CoolerEnvError } from "./lib/errors";

export interface LoadEnvOptions {
  /** Directory holding the key/encrypted files. Defaults to `config`. */
  configPath?: string;
  /** Also write each secret into `process.env`. Default: false. */
  inject?: boolean;
  /**
   * When injecting, overwrite variables already set in the environment.
   * Default: false, so a shell/CI-provided value wins over the encrypted file.
   */
  override?: boolean;
}

/**
 * Decrypt an environment's secrets and return them.
 *
 * By default this is a pure read: nothing global is touched, and you use the
 * returned object (`const env = await loadEnv("production"); env.TOKEN`). Pass
 * `inject: true` to also write each secret into `process.env`.
 *
 * @param env  The environment name, e.g. `process.env.NODE_ENV`.
 */
export const loadEnv = async (
  env: string,
  { configPath, inject = false, override = false }: LoadEnvOptions = {}
): Promise<Secrets> => {
  if (!env) {
    throw new CoolerEnvError(
      "loadEnv requires a valid environment name to be passed as an argument."
    );
  }

  const paths = resolvePaths(env, configPath);
  const secrets = await readSecrets(paths);

  if (inject) {
    for (const [key, value] of Object.entries(secrets)) {
      if (override || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  return secrets;
};
