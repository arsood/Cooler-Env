const inquirer = require("inquirer");
const fs = require("fs");
const path = require("path");
const clear = require("clear");
const chalk = require("chalk");
const figlet = require("figlet");
const Cryptify = require("cryptify");

const add = (argv: any) => {
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

  inquirer
    .prompt([
      {
        name: "keyName",
        type: "input",
        message: "What is the name of the key you would like to add?",
        validate: (value: string) => {
          if (value.length) {
            return true;
          }

          return "Please enter the name of the key you would like to add.";
        },
      },
      {
        name: "keyValue",
        type: "input",
        message: "What is the value of the key you would like to add?",
        validate: (value: string) => {
          if (value.length) {
            return true;
          }

          return "Please enter the value of the key you would like to add.";
        },
      },
    ])
    .then((answers: any) => {
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

      decryptedFileInstance
        .decrypt()
        .then((files: string[]) => {
          fs.unlinkSync(DECRYPTED_FILE_PATH);

          const parsedObj = JSON.parse(files[0]);

          if (parsedObj[answers.keyName]) {
            return console.log(
              chalk.red("The key exists already. Try editing instead?")
            );
          }

          parsedObj[answers.keyName] = answers.keyValue;

          fs.writeFileSync(ENCRYPTED_FILE_PATH, JSON.stringify(parsedObj));

          const encryptedFileInstance = new Cryptify(
            ENCRYPTED_FILE_PATH,
            secretKeyData,
            null,
            null,
            true,
            true
          );

          encryptedFileInstance.encrypt();
        })
        .then(() => {
          console.log("Done! 🌟");
        });
    });
};

export default add;
