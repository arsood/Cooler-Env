const inquirer = require("inquirer");
const fs = require("fs");
const path = require("path");
const clear = require("clear");
const chalk = require("chalk");
const figlet = require("figlet");
const Cryptify = require("cryptify");

const add = (argv) => {
  clear();

  console.log(
    chalk.green(
      figlet.textSync("Cooler Env", { horizontalLayout: "full" })
    )
  );

  inquirer
  .prompt([
    {
      name: "keyName",
      type: "input",
      message: "What is the name of the key you would like to add?",
      validate: (value) => {
        if (value.length) {
          return true;
        }

        return "Please enter the name of the key you would like to add.";
      }
    },
    {
      name: "keyValue",
      type: "input",
      message: "What is the value of the key you would like to add?",
      validate: (value) => {
        if (value.length) {
          return true;
        }

        return "Please enter the value of the key you would like to add.";
      }
    }
  ])
  .then((answers) => {
    const secretKeyData = fs
    .readFileSync(path.join(__dirname, `../config/${argv.e}.key`))
    .toString();

    const encryptedFileInstance = new Cryptify(path.join(__dirname, `../config/${argv.e}.yml.enc`), secretKeyData, null, null, true, true);

    encryptedFileInstance
    .decrypt()
    .then((files) => {
      const parsedObj = JSON.parse(files[0]);

      if (parsedObj[answers.keyName]) {
        return console.log(chalk.red("The key exists already. Try editing instead?"));
      }

      parsedObj[answers.keyName] = answers.keyValue;

      fs.writeFileSync(path.join(__dirname, `../config/${argv.e}.yml.enc`), JSON.stringify(parsedObj));
    })
    .then(() => {
      encryptedFileInstance.encrypt();
    })
    .then(() => {
      console.log("Done! 🌟");
    });
  });
}

module.exports = add;
