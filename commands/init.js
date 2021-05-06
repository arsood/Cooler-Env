const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const crypto = require("crypto");
const Cryptify = require("cryptify");

const init = (argv) => {
  clear();

  console.log(
    chalk.green(
      figlet.textSync("Cooler Env", { horizontalLayout: "full" })
    )
  );
  
  if (!argv.e) {
    return console.log(
      chalk.red("Please enter a valid environment with the -e option")
    );
  }

  if (!fs.existsSync(path.join(__dirname, `../config`))) {
    fs.mkdirSync(path.join(__dirname, `../config`));
  }

  const newKey = crypto.randomBytes(16).toString("hex");

  fs.writeFile(path.join(__dirname, `../config/${argv.e}.key`), newKey, (mkfileErr) => {
    if (mkfileErr) {
      return console.log(chalk.red("There was an error writing the appropriate files \n\n"), mkfileErr);
    }
  });

  fs.writeFile(path.join(__dirname, `../config/${argv.e}.yml.enc`), "{}", (mkfileErr) => {
    if (mkfileErr) {
      return console.log(chalk.red("There was an error writing the appropriate files \n\n"), mkfileErr);
    }

    const encryptedFileInstance = new Cryptify(path.join(__dirname, `../config/${argv.e}.yml.enc`), newKey, null, null, true, true);

    encryptedFileInstance.encrypt();
  });
}

module.exports = init;
