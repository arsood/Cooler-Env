import path from "path";
import { Argv, Paths } from "./types";
import { CoolerEnvError } from "./errors";

export const DEFAULT_CONFIG_DIR = "config";

// Environment names become file names (`<env>.key`, `<env>.yml.enc`). The
// only hard requirements are that a name stays inside the config directory
// and fits in a file name; anything else (unicode, `@`, spaces) is allowed so
// existing environments keep working.
const MAX_ENV_NAME_LENGTH = 200;

/**
 * Validate an environment name, throwing a user-facing error if it could not
 * safely be used as a file name inside the config directory.
 */
export const validateEnvName = (env: unknown): string => {
  if (typeof env !== "string" || env.trim() === "") {
    throw new CoolerEnvError(
      "Please provide a valid environment name (e.g. development, production).",
    );
  }

  if (env === "." || env === ".." || /[/\\\0]/.test(env)) {
    throw new CoolerEnvError(
      `Invalid environment name "${env}". It cannot contain path separators or be "." or "..".`,
    );
  }

  if (env.length > MAX_ENV_NAME_LENGTH) {
    throw new CoolerEnvError(
      `Invalid environment name: it must be at most ${MAX_ENV_NAME_LENGTH} characters.`,
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
  const configDir = path.resolve(
    process.cwd(),
    configPath || DEFAULT_CONFIG_DIR,
  );

  return {
    configDir,
    keyFile: path.join(configDir, `${env}.key`),
    encryptedFile: path.join(configDir, `${env}.yml.enc`),
  };
};

/** Extract and validate the `-e` environment name from parsed CLI args. */
export const requireEnv = (argv: Argv): string => {
  if (Array.isArray(argv.e)) {
    throw new CoolerEnvError("Please provide the -e option only once.");
  }

  // minimist yields "" for a bare `-e` and `false` for `--no-e`.
  if (typeof argv.e !== "string" || argv.e.trim() === "") {
    throw new CoolerEnvError(
      "Please provide a valid environment with the -e option",
    );
  }

  return validateEnvName(argv.e);
};

/** Extract the optional `-p` config path. */
export const configPathOf = (argv: Argv): string | undefined => {
  if (argv.p === undefined) return undefined;

  if (Array.isArray(argv.p)) {
    throw new CoolerEnvError("Please provide the -p option only once.");
  }

  // A bare `-p` (or `-p` followed by another flag) yields "" rather than
  // undefined, so it can be told apart from an absent option.
  if (typeof argv.p !== "string" || argv.p.trim() === "") {
    throw new CoolerEnvError("The -p option requires a directory path.");
  }

  return argv.p;
};
