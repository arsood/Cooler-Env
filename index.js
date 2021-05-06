const clear = require("clear");
const chalk = require("chalk");
const figlet = require("figlet");
const minimist = require("minimist");

const init = require("./commands/init");
const edit = require("./commands/edit");
const add = require("./commands/add");

const loadEnv = require("./loadEnv");

const argv = minimist(process.argv.slice(2));

if (argv._.length === 0) {
  return console.log(chalk.red("Please enter a valid command"));
}

const availableCommands = {
  "init": init,
  "edit": edit,
  "add": add
};

if (availableCommands[argv._[0]]) {
  availableCommands[argv._[0]](argv);
} else {
  console.log(chalk.red("Please enter a valid command"));
}

module.exports = {
  loadEnv
};
