import chalk from "chalk";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { assertInitialized } from "../lib/guards";
import { readSecrets } from "../lib/secrets";

const list = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));
  assertInitialized(paths, env);

  const secrets = await readSecrets(paths);
  const keys = Object.keys(secrets).sort();

  if (keys.length === 0) {
    console.log(chalk.yellow("No keys set."));
    return;
  }

  // Key names only by default; `--values` opts into printing the secrets too.
  const withValues = argv.values === true;

  for (const key of keys) {
    console.log(withValues ? `${key}=${secrets[key]}` : key);
  }
};

export default list;
