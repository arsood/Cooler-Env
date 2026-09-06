import minimist from "minimist";

import { Argv } from "./lib/types";
import { CoolerEnvError } from "./lib/errors";

import init from "./commands/init";
import add from "./commands/add";
import edit from "./commands/edit";
import deleteCmd from "./commands/delete";

type Command = (argv: Argv) => Promise<void>;

const commands: Record<string, Command> = {
  init,
  add,
  edit,
  delete: deleteCmd,
};

export const COMMAND_NAMES = Object.keys(commands);

/**
 * Parse raw CLI arguments and dispatch to a command. Throws `CoolerEnvError`
 * for bad input; the caller decides how to print it.
 */
export const run = async (args: string[]): Promise<void> => {
  // Declare -e/-p as strings so minimist never coerces them to numbers or
  // booleans (e.g. `-p 123` or a bare `-e`), and --show as a boolean so it
  // never swallows a following argument.
  const argv = minimist(args, {
    string: ["e", "p"],
    boolean: ["show"],
  }) as unknown as Argv;
  const name = argv._[0];

  // Look up as an own property so names like "constructor" or "toString"
  // don't resolve to Object.prototype methods.
  const command = Object.prototype.hasOwnProperty.call(commands, name)
    ? commands[name]
    : undefined;

  if (!command) {
    throw new CoolerEnvError(
      `Please enter a valid command: ${COMMAND_NAMES.join(", ")}.`,
    );
  }

  await command(argv);
};
