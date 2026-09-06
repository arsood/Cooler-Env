import chalk from "chalk";
import inquirer from "inquirer";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { assertInitialized, validateKeyName } from "../lib/guards";
import { readSecretsWithKey, writeSecrets } from "../lib/secrets";
import { CoolerEnvError } from "../lib/errors";

interface Pair {
  keyName: string;
  keyValue: string;
}

/** Read all of stdin (used when a non-interactive value is piped in). */
const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

/** Collect the key/value from `-k`/`-v` (or piped stdin) for scripted use. */
const fromArgs = async (argv: Argv): Promise<Pair> => {
  if (argv.key === undefined) {
    throw new CoolerEnvError(
      "The --value (-v) option requires a key; pass --key (-k) too.",
    );
  }
  if (Array.isArray(argv.key)) {
    throw new CoolerEnvError("Please provide the -k/--key option only once.");
  }
  if (Array.isArray(argv.value)) {
    throw new CoolerEnvError("Please provide the -v/--value option only once.");
  }

  const keyName = String(argv.key).trim();
  const valid = validateKeyName(keyName);
  if (valid !== true) throw new CoolerEnvError(valid);

  let keyValue: string;
  if (argv.value !== undefined) {
    keyValue = String(argv.value);
  } else if (process.stdin.isTTY) {
    throw new CoolerEnvError(
      "Provide a value with --value (-v), or pipe it to stdin.",
    );
  } else {
    // Drop a single trailing newline, matching how `$(cmd)` and `echo` behave.
    keyValue = (await readStdin()).replace(/\r?\n$/, "");
  }

  return { keyName, keyValue };
};

/** Prompt for the key and value interactively. */
const fromPrompt = async (argv: Argv): Promise<Pair> => {
  // Mask the secret value by default so it isn't echoed to the terminal (and
  // captured in scrollback). A `password` prompt with no `mask` hides the
  // value entirely — including its length. `--show` opts into a visible
  // `input` prompt instead.
  const show = argv.show === true;

  const answers = await inquirer.prompt<Pair>([
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

  return { keyName: answers.keyName.trim(), keyValue: answers.keyValue };
};

const add = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));
  assertInitialized(paths, env);

  const { secrets, secretKey } = await readSecretsWithKey(paths);

  // `-k`/`-v` (or a piped value) means non-interactive; otherwise prompt.
  const nonInteractive = argv.key !== undefined || argv.value !== undefined;
  const { keyName, keyValue } = nonInteractive
    ? await fromArgs(argv)
    : await fromPrompt(argv);

  if (secrets[keyName] !== undefined) {
    throw new CoolerEnvError(
      `The key "${keyName}" already exists. Try editing it instead.`,
    );
  }

  secrets[keyName] = keyValue;
  await writeSecrets(paths, secrets, secretKey);

  console.log(chalk.green("Done! 🌟"));
};

export default add;
