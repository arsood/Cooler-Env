import chalk from "chalk";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { assertInitialized } from "../lib/guards";
import { readSecrets } from "../lib/secrets";
import { formatEnvValue } from "../lib/dotenv";

const list = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));
  assertInitialized(paths, env);

  const secrets = await readSecrets(paths);
  const keys = Object.keys(secrets).sort();

  if (keys.length === 0) {
    // Diagnostic, not data — keep stdout empty so `list | ...` sees nothing.
    console.error(chalk.yellow("No keys set."));
    return;
  }

  // Key names only by default; `--values` opts into printing the secrets too.
  // Values are formatted so one with a newline (or `=`, spaces, quotes) can't
  // break the one-key-per-line output or spoof another key.
  const withValues = argv.values === true;

  for (const key of keys) {
    console.log(withValues ? `${key}=${formatEnvValue(secrets[key])}` : key);
  }
};

export default list;
