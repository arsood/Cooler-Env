import chalk from "chalk";
import inquirer from "inquirer";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { assertInitialized, validateKeyName } from "../lib/guards";
import { readSecretsWithKey, writeSecrets } from "../lib/secrets";
import { CoolerEnvError } from "../lib/errors";

const add = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));
  assertInitialized(paths, env);

  const { secrets, password } = await readSecretsWithKey(paths);

  // Mask the secret value by default so it isn't echoed to the terminal (and
  // captured in scrollback). A `password` prompt with no `mask` hides the
  // value entirely — including its length. `--show` opts into a visible
  // `input` prompt instead.
  const show = argv.show === true;

  const answers = await inquirer.prompt<{ keyName: string; keyValue: string }>([
    {
      name: "keyName",
      type: "input",
      message: "What is the name of the key you would like to add?",
      validate: validateKeyName,
    },
    {
      name: "keyValue",
      type: show ? "input" : "password",
      message: "What is the value of the key you would like to add?",
    },
  ]);

  const keyName = answers.keyName.trim();

  if (secrets[keyName] !== undefined) {
    throw new CoolerEnvError(
      `The key "${keyName}" already exists. Try editing it instead.`,
    );
  }

  secrets[keyName] = answers.keyValue;
  await writeSecrets(paths, secrets, password);

  console.log(chalk.green("Done! 🌟"));
};

export default add;
