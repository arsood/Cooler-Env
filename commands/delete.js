const path = require("path");
const chalk = require("chalk");
const figlet = require("figlet");
const fs = require("fs");
const clear = require("clear");
const Cryptify = require("cryptify");
const inquirer = require("inquirer");

const deleteCmd = (argv) => {
  const ENCRYPTION_KEY_PATH = path.join(process.cwd(), `config/${argv.e}.key`);
  const ENCRYPTED_FILE_PATH = path.join(process.cwd(), `config/${argv.e}.yml.enc`);

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

  if (!fs.existsSync(ENCRYPTION_KEY_PATH)) {
    return console.log(chalk.red(`Encryption key not found for environment "${argv.e}"`));
  }

  if (!fs.existsSync(ENCRYPTED_FILE_PATH)) {
    return console.log(chalk.red(`Encrypted file not found for environment "${argv.e}"`));
  }

  const secretKeyData = fs
  .readFileSync(ENCRYPTION_KEY_PATH)
  .toString();

  const encryptedFileInstance = new Cryptify(ENCRYPTED_FILE_PATH, secretKeyData, null, null, true, true);

  encryptedFileInstance
  .decrypt()
  .then((files) => {
    const parsedObj = JSON.parse(files[0]);

    // Encrypt again to protect against user SIGINT corrupting file
    encryptedFileInstance.encrypt();

    if (Object.keys(parsedObj).length === 0) {
      return console.log(chalk.red("Nothing to delete. Please add some keys first."));
    }

    inquirer
    .prompt([
      {
        name: "keysToDelete",
        type: "checkbox",
        message: "Which key(s) would you like to delete?",
        choices: Object.keys(parsedObj)
      }
    ])
    .then((answers) => {
      const filteredKeys = Object
      .keys(parsedObj)
      .filter((key) => {
        if (answers.keysToDelete.includes(key)) {
          return false;
        }

        return true;
      });

      let newObj = {};

      filteredKeys.forEach((key) => {
        newObj[key] = parsedObj[key];
      });

      fs.writeFileSync(ENCRYPTED_FILE_PATH, JSON.stringify(newObj));

      encryptedFileInstance.encrypt();
    })
    .then(() => {
      console.log("Done! 🌟");
    });
  });
}

module.exports = deleteCmd;
