const path = require("path");
const chalk = require("chalk");
const figlet = require("figlet");
const fs = require("fs");
const clear = require("clear");
const Cryptify = require("cryptify");
const inquirer = require("inquirer");

const edit = (argv) => {
  const ENCRYPTION_KEY_PATH = path.join(__dirname, `../config/${argv.e}.key`);
  const ENCRYPTED_FILE_PATH = path.join(__dirname, `../config/${argv.e}.yml.enc`);

  clear();

  console.log(
    chalk.green(
      figlet.textSync("Cooler Env", { horizontalLayout: "full" })
    )
  );

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
      return console.log(chalk.red("Nothing to edit. Please add some keys first."));
    }

    inquirer
    .prompt([
      {
        name: "keyToEdit",
        type: "list",
        message: "Which key would you like to edit?",
        choices: Object.keys(parsedObj)
      }
    ])
    .then((listAnswers) => {
      inquirer
      .prompt([
        {
          name: "keyEditedValue",
          type: "input",
          message: "What is the new value of this key?",
          default: parsedObj[listAnswers.keyToEdit],
          validate: (value) => {
            if (value.length) {
              return true;
            }

            return "Please enter the new value of the key you would like to edit.";
          }
        }
      ])
      .then((inputAnswers) => {
        parsedObj[listAnswers.keyToEdit] = inputAnswers.keyEditedValue;

        fs.writeFileSync(ENCRYPTED_FILE_PATH, JSON.stringify(parsedObj));
      })
      .then(() => {
        encryptedFileInstance.encrypt();
      })
      .then(() => {
        console.log("Done! 🌟");
      });
    });
  });
}

module.exports = edit;
