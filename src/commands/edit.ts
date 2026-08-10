import chalk from "chalk";
import inquirer from "inquirer";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { assertInitialized, validateValue } from "../lib/guards";
import { readSecrets, writeSecrets } from "../lib/secrets";
import { CoolerEnvError } from "../lib/errors";

const edit = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));
  assertInitialized(paths, env);

  const secrets = await readSecrets(paths);
  const keys = Object.keys(secrets);

  if (keys.length === 0) {
    throw new CoolerEnvError("Nothing to edit. Add some keys first.");
  }

  const { keyToEdit } = await inquirer.prompt<{ keyToEdit: string }>([
    {
      name: "keyToEdit",
      type: "list",
      message: "Which key would you like to edit?",
      choices: keys,
    },
  ]);

  const { keyEditedValue } = await inquirer.prompt<{ keyEditedValue: string }>([
    {
      name: "keyEditedValue",
      type: "input",
      message: "What is the new value of this key?",
      default: secrets[keyToEdit],
      validate: validateValue,
    },
  ]);

  secrets[keyToEdit] = keyEditedValue;
  await writeSecrets(paths, secrets);

  console.log(chalk.green("Done! 🌟"));
};

export default edit;
