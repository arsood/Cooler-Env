import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import clear from "clear";
import chalk from "chalk";
import figlet from "figlet";
import Cryptify from "cryptify";

const deleteCmd = (argv: any) => {
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
    undefined,
    undefined,
    true,
    true
  );

  decryptedFileInstance.decrypt().then((files) => {
    fs.unlinkSync(DECRYPTED_FILE_PATH);

    if (!files) return;

    const parsedObj = JSON.parse(files[0]);

    if (Object.keys(parsedObj).length === 0) {
      return console.log(
        chalk.red("Nothing to delete. Please add some keys first.")
      );
    }

    inquirer
      .prompt([
        {
          name: "keysToDelete",
          type: "checkbox",
          message: "Which key(s) would you like to delete?",
          choices: Object.keys(parsedObj),
        },
      ])
      .then((answers: any) => {
        const filteredKeys = Object.keys(parsedObj).filter((key) => {
          if (answers.keysToDelete.includes(key)) {
            return false;
          }

          return true;
        });

        let newObj = {} as { [key: string]: string };

        filteredKeys.forEach((key) => {
          newObj[key] = parsedObj[key];
        });

        const encryptedFileInstance = new Cryptify(
          ENCRYPTED_FILE_PATH,
          secretKeyData,
          undefined,
          undefined,
          true,
          true
        );

        fs.writeFileSync(ENCRYPTED_FILE_PATH, JSON.stringify(newObj));

        encryptedFileInstance.encrypt();
      })
      .then(() => {
        console.log("Done! 🌟");
      });
  });
};

export default deleteCmd;
