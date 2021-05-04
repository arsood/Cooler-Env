const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const crypto = require("crypto");

const init = (argv) => {
  if (!fs.existsSync(path.join(__dirname, `../config`))) {
    fs.mkdirSync(path.join(__dirname, `../config`));
  }

  const newKey = crypto.randomBytes(16).toString('hex');

  fs.writeFile(path.join(__dirname, `../config/${argv.e}.key`), newKey, (mkfileErr) => {
    if (mkfileErr) {
      return console.log(chalk.red("There was an error writing the appropriate files \n\n"), mkfileErr);
    }
  });

  fs.writeFile(path.join(__dirname, `../config/${argv.e}.yml.enc`), "", (mkfileErr) => {
    if (mkfileErr) {
      return console.log(chalk.red("There was an error writing the appropriate files \n\n"), mkfileErr);
    }
  });

  fs.writeFile(path.join(__dirname, `../config/${argv.e}.iv`), crypto.randomBytes(8).toString("hex"), (mkfileErr) => {
    if (mkfileErr) {
      return console.log(chalk.red("There was an error writing the appropriate files \n\n"), mkfileErr);
    }
  });
}

module.exports = init;
