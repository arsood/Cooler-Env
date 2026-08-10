import chalk from "chalk";
import inquirer from "inquirer";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { assertInitialized } from "../lib/guards";
import { readSecrets, writeSecrets } from "../lib/secrets";
import { CoolerEnvError } from "../lib/errors";

const deleteCmd = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));
  assertInitialized(paths, env);

  const secrets = await readSecrets(paths);
  const keys = Object.keys(secrets);

  if (keys.length === 0) {
    throw new CoolerEnvError("Nothing to delete. Add some keys first.");
  }

  const { keysToDelete } = await inquirer.prompt<{ keysToDelete: string[] }>([
    {
      name: "keysToDelete",
      type: "checkbox",
      message: "Which key(s) would you like to delete?",
      choices: keys,
    },
  ]);

  if (keysToDelete.length === 0) {
    console.log(chalk.yellow("No keys selected. Nothing changed."));
    return;
  }

  for (const key of keysToDelete) {
    delete secrets[key];
  }

  await writeSecrets(paths, secrets);

  console.log(chalk.green("Done! 🌟"));
};

export default deleteCmd;
