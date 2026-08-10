import path from "path";
import { Argv, Paths } from "./types";
import { CoolerEnvError } from "./errors";

export const DEFAULT_CONFIG_DIR = "config";

/**
 * Build the per-environment file trio (key + encrypted file) rooted at the
 * config directory (default `config/`, overridable via configPath).
 */
export const resolvePaths = (env: string, configPath?: string): Paths => {
  const configDir = path.join(process.cwd(), configPath || DEFAULT_CONFIG_DIR);

  return {
    configDir,
    keyFile: path.join(configDir, `${env}.key`),
    encryptedFile: path.join(configDir, `${env}.yml.enc`),
  };
};

/**
 * Extract and validate the `-e` environment name from parsed CLI args.
 * minimist can hand back numbers or booleans, so coerce and reject anything
 * that isn't a usable non-empty string.
 */
export const requireEnv = (argv: Argv): string => {
  const { e } = argv;

  if (e === undefined || typeof e === "boolean" || String(e).trim() === "") {
    throw new CoolerEnvError(
      "Please provide a valid environment with the -e option"
    );
  }

  return String(e);
};

/** Extract the optional `-p` config path, ignoring non-string values. */
export const configPathOf = (argv: Argv): string | undefined =>
  typeof argv.p === "string" && argv.p.length ? argv.p : undefined;
