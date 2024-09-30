#!/usr/bin/env node

import chalk from "chalk";
import minimist from "minimist";
import clear from "clear";
import figlet from "figlet";

import init from "./commands/init";
import edit from "./commands/edit";
import add from "./commands/add";
import deleteCmd from "./commands/delete";

clear();

console.log(
  chalk.green(figlet.textSync("Cooler Env", { horizontalLayout: "full" }))
);

const argv = minimist(process.argv.slice(2));

if (argv._.length === 0) {
  console.log(chalk.red("Please enter a valid command"));
}

const availableCommands = {
  init: init,
  edit: edit,
  add: add,
  delete: deleteCmd,
} as { [key: string]: any };

if (availableCommands[argv._[0]]) {
  availableCommands[argv._[0]](argv);
} else {
  console.log(chalk.red("Please enter a valid command"));
}
