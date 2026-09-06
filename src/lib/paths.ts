import path from "path";
import { Argv, Paths } from "./types";
import { CoolerEnvError } from "./errors";

export const DEFAULT_CONFIG_DIR = "config";

// Environment names become file names (`<env>.key`, `<env>.yml.enc`), so keep
// them to a conservative character set and rule out path segments like `..`.
const ENV_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

/**
 * Validate an environment name, throwing a user-facing error if it could not
 * safely be used as a file name inside the config directory.
 */
export const validateEnvName = (env: unknown): string => {
  if (typeof env !== "string" || env.trim() === "") {
    throw new CoolerEnvError(
      "Please provide a valid environment name (e.g. development, production)."
    );
  }

  if (!ENV_NAME_PATTERN.test(env) || env === "." || env === "..") {
    throw new CoolerEnvError(
      `Invalid environment name "${env}". Use letters, numbers, "_", "-" or "." only.`
    );
  }

  return env;
};

/**
 * Build the per-environment file trio (key + encrypted file) rooted at the
 * config directory (default `config/`, overridable via configPath). A relative
 * configPath is resolved against the current working directory; an absolute
 * one is used as-is.
 */
export const resolvePaths = (env: string, configPath?: string): Paths => {
  const configDir = path.resolve(process.cwd(), configPath || DEFAULT_CONFIG_DIR);

  return {
    configDir,
    keyFile: path.join(configDir, `${env}.key`),
    encryptedFile: path.join(configDir, `${env}.yml.enc`),
  };
};

/** Extract and validate the `-e` environment name from parsed CLI args. */
export const requireEnv = (argv: Argv): string => {
  if (argv.e === undefined || argv.e === "") {
    throw new CoolerEnvError(
      "Please provide a valid environment with the -e option"
    );
  }

  if (Array.isArray(argv.e)) {
    throw new CoolerEnvError("Please provide the -e option only once.");
  }

  return validateEnvName(argv.e);
};

/** Extract the optional `-p` config path. */
export const configPathOf = (argv: Argv): string | undefined => {
  if (argv.p === undefined || argv.p === "") return undefined;

  if (Array.isArray(argv.p)) {
    throw new CoolerEnvError("Please provide the -p option only once.");
  }

  return argv.p;
};
