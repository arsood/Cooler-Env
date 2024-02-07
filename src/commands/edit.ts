const path = require("path");
const chalk = require("chalk");
const figlet = require("figlet");
const fs = require("fs");
const clear = require("clear");
const Cryptify = require("cryptify");
const inquirer = require("inquirer");

const edit = (argv) => {
  const CONFIG_DIR_PATH = path.join(process.cwd(), argv.p ? argv.p : "config");
  const ENCRYPTION_KEY_PATH = path.join(CONFIG_DIR_PATH, `${argv.e}.key`);
  const ENCRYPTED_FILE_PATH = path.join(CONFIG_DIR_PATH, `${argv.e}.yml.enc`);
  const DECRYPTED_FILE_PATH = path.join(
    CONFIG_DIR_PATH,
    `${argv.e}-d.yml.enc.tmp`
  );

  clear();

  console.log(
    chalk.green(figlet.textSync("Cooler Env", { horizontalLayout: "full" }))
  );

  if (!argv.e) {
    return console.log(
      chalk.red("Please enter a valid environment with the -e option")
    );
  }

  if (!fs.existsSync(ENCRYPTION_KEY_PATH)) {
    return console.log(
      chalk.red(`Encryption key not found for environment "${argv.e}"`)
    );
  }

  if (!fs.existsSync(ENCRYPTED_FILE_PATH)) {
    return console.log(
      chalk.red(`Encrypted file not found for environment "${argv.e}"`)
    );
  }

  fs.copyFileSync(ENCRYPTED_FILE_PATH, DECRYPTED_FILE_PATH);

  const secretKeyData = fs.readFileSync(ENCRYPTION_KEY_PATH).toString();

  const decryptedFileInstance = new Cryptify(
    DECRYPTED_FILE_PATH,
    secretKeyData,
    null,
    null,
    true,
    true
  );

  decryptedFileInstance.decrypt().then((files) => {
    fs.unlinkSync(DECRYPTED_FILE_PATH);

    const parsedObj = JSON.parse(files[0]);

    if (Object.keys(parsedObj).length === 0) {
      return console.log(
        chalk.red("Nothing to edit. Please add some keys first.")
      );
    }

    inquirer
      .prompt([
        {
          name: "keyToEdit",
          type: "list",
          message: "Which key would you like to edit?",
          choices: Object.keys(parsedObj),
        },
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
              },
            },
          ])
          .then((inputAnswers) => {
            parsedObj[listAnswers.keyToEdit] = inputAnswers.keyEditedValue;

            const encryptedFileInstance = new Cryptify(
              ENCRYPTED_FILE_PATH,
              secretKeyData,
              null,
              null,
              true,
              true
            );

            fs.writeFileSync(ENCRYPTED_FILE_PATH, JSON.stringify(parsedObj));

            encryptedFileInstance.encrypt();
          })
          .then(() => {
            console.log("Done! 🌟");
          });
      });
  });
};

export default edit;
