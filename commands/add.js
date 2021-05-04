const inquirer = require("inquirer");
const fs = require("fs");
const path = require("path");
const clear = require("clear");
const chalk = require("chalk");
const figlet = require("figlet");

const fileEncryption = require("../utils/fileEncryption");

const add = (argv) => {
  clear();

  console.log(
    chalk.green(
      figlet.textSync('Cooler Env', { horizontalLayout: 'full' })
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
    const encryptedFilePath = path.join(__dirname, `../config/${argv.e}.yml.enc`);
    const encryptionKey = path.join(__dirname, `../config/${argv.e}.key`);
    const ivPath = path.join(__dirname, `../config/${argv.e}.iv`);

    fileEncryption
    .decryptFile(encryptedFilePath, encryptionKey, ivPath)
    .then((decryptedFile) => {
      const newDataToEncrypt = decryptedFile + `${answers.keyName}: ${answers.keyValue}\n`;

      fileEncryption
      .encryptFile(encryptionKey, ivPath, newDataToEncrypt)
      .then((encryptedFile) => {
        fs.appendFile(encryptedFilePath, encryptedFile, (editFileErr) => {
          if (editFileErr) {
            return console.log(chalk.red("There was an error adding the key-value pair"), editFileErr);
          }
    
          console.log("Done! 🌟");
        });
      });
    });
  });
}

module.exports = add;
