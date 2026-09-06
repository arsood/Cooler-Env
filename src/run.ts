import minimist from "minimist";
import chalk from "chalk";

import { Argv } from "./lib/types";
import { CoolerEnvError } from "./lib/errors";
import { getVersion, helpText } from "./lib/usage";

import init from "./commands/init";
import add from "./commands/add";
import edit from "./commands/edit";
import deleteCmd from "./commands/delete";
import list from "./commands/list";

type Command = (argv: Argv) => Promise<void>;

const commands: Record<string, Command> = {
  init,
  add,
  edit,
  delete: deleteCmd,
  list,
};

export const COMMAND_NAMES = Object.keys(commands);

// Every option any command understands, plus the aliases minimist adds. An
// argument key outside this set is a typo/unsupported flag worth warning about.
const KNOWN_OPTIONS = new Set([
  "_",
  "e",
  "p",
  "show",
  "values",
  "help",
  "h",
  "version",
  "v",
]);

const warnUnknownOptions = (argv: Argv): void => {
  for (const key of Object.keys(argv)) {
    if (!KNOWN_OPTIONS.has(key)) {
      const flag = key.length === 1 ? `-${key}` : `--${key}`;
      console.error(chalk.yellow(`Warning: unknown option ${flag} (ignored).`));
    }
  }
};

/**
 * Parse raw CLI arguments and dispatch to a command. Throws `CoolerEnvError`
 * for bad input; the caller decides how to print it.
 */
export const run = async (args: string[]): Promise<void> => {
  // Declare -e/-p as strings so minimist never coerces them to numbers or
  // booleans (e.g. `-p 123` or a bare `-e`), and the flag options as booleans
  // so they never swallow a following argument.
  const argv = minimist(args, {
    string: ["e", "p"],
    boolean: ["show", "values", "help", "version"],
    alias: { h: "help", v: "version" },
  }) as unknown as Argv;

  if (argv.version === true) {
    console.log(getVersion());
    return;
  }

  if (argv.help === true) {
    console.log(helpText());
    return;
  }

  warnUnknownOptions(argv);

  const name = argv._[0];

  // Look up as an own property so names like "constructor" or "toString"
  // don't resolve to Object.prototype methods.
  const command = Object.prototype.hasOwnProperty.call(commands, name)
    ? commands[name]
    : undefined;

  if (!command) {
    throw new CoolerEnvError(
      `Please enter a valid command: ${COMMAND_NAMES.join(", ")}. Run \`cooler-env --help\` for usage.`,
    );
  }

  await command(argv);
};
