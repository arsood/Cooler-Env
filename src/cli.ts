#!/usr/bin/env node

import chalk from "chalk";
import minimist from "minimist";

import { Argv } from "./lib/types";
import { printBanner } from "./lib/banner";
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

const main = async (): Promise<void> => {
  printBanner();

  const argv = minimist(process.argv.slice(2)) as unknown as Argv;
  const command = commands[argv._[0]];

  if (!command) {
    throw new CoolerEnvError(
      "Please enter a valid command: init, add, edit, or delete."
    );
  }

  await command(argv);
};

main().catch((error: unknown) => {
  process.exitCode = 1;

  if (error instanceof CoolerEnvError) {
    console.log(chalk.red(error.message));
    return;
  }

  // inquirer throws this when the user aborts a prompt (e.g. Ctrl+C).
  if (error instanceof Error && error.name === "ExitPromptError") {
    console.log(chalk.yellow("Cancelled."));
    return;
  }

  console.log(chalk.red("Cooler-Env: an unexpected error occurred."));
  console.error(error);
});
