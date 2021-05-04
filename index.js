const clear = require("clear");
const chalk = require("chalk");
const figlet = require("figlet");
const minimist = require("minimist");

const init = require("./commands/init");
const edit = require("./commands/edit");

clear();

console.log(
  chalk.green(
    figlet.textSync('Cooler Env', { horizontalLayout: 'full' })
  )
);

const argv = minimist(process.argv.slice(2));

if (argv._.length === 0) {
  return console.log(chalk.red("Please enter a valid command"));
}

const availableCommands = {
  "init": init,
  "edit": edit
};

if (availableCommands[argv._[0]]) {
  return availableCommands[argv._[0]](argv);
} else {
  return console.log(chalk.red("Please enter a valid command"));
}
