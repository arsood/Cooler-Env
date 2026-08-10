import chalk from "chalk";
import inquirer from "inquirer";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { assertInitialized, validateKeyName, validateValue } from "../lib/guards";
import { readSecrets, writeSecrets } from "../lib/secrets";
import { CoolerEnvError } from "../lib/errors";

const add = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));
  assertInitialized(paths, env);

  const secrets = await readSecrets(paths);

  const answers = await inquirer.prompt<{ keyName: string; keyValue: string }>([
    {
      name: "keyName",
      type: "input",
      message: "What is the name of the key you would like to add?",
      validate: validateKeyName,
    },
    {
      name: "keyValue",
      type: "input",
      message: "What is the value of the key you would like to add?",
      validate: validateValue,
    },
  ]);

  const keyName = answers.keyName.trim();

  if (secrets[keyName] !== undefined) {
    throw new CoolerEnvError(
      `The key "${keyName}" already exists. Try editing it instead.`
    );
  }

  secrets[keyName] = answers.keyValue;
  await writeSecrets(paths, secrets);

  console.log(chalk.green("Done! 🌟"));
};

export default add;
