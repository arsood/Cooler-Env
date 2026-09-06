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
      type: "select",
      message: "Which key would you like to edit?",
      choices: keys,
    },
  ]);

  // By default, mask the new value and do NOT pre-fill the current one, so a
  // secret is never echoed to the terminal. `--show` reveals typing and offers
  // the current value as the editable default.
  const show = argv.show === true;

  const { keyEditedValue } = await inquirer.prompt<{ keyEditedValue: string }>([
    {
      name: "keyEditedValue",
      type: show ? "input" : "password",
      mask: show ? undefined : "*",
      message: "What is the new value of this key?",
      default: show ? secrets[keyToEdit] : undefined,
      validate: validateValue,
    },
  ]);

  secrets[keyToEdit] = keyEditedValue;
  await writeSecrets(paths, secrets);

  console.log(chalk.green("Done! 🌟"));
};

export default edit;
