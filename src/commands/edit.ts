import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import clear from "clear";
import chalk from "chalk";
import figlet from "figlet";
import Cryptify from "cryptify";

const edit = async (argv: any) => {
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

  const files = await decryptedFileInstance.decrypt();

  fs.unlinkSync(DECRYPTED_FILE_PATH);

  if (!files) return;

  const parsedObj = JSON.parse(files[0]);

  if (Object.keys(parsedObj).length === 0) {
    return console.log(
      chalk.red("Nothing to edit. Please add some keys first.")
    );
  }

  try {
    const listAnswers = await inquirer.prompt([
      {
        name: "keyToEdit",
        type: "list",
        message: "Which key would you like to edit?",
        choices: Object.keys(parsedObj),
      },
    ]);

    const inputAnswers = await inquirer.prompt([
      {
        name: "keyEditedValue",
        type: "input",
        message: "What is the new value of this key?",
        default: parsedObj[listAnswers.keyToEdit],
        validate: (value: string) => {
          if (value.length) {
            return true;
          }

          return "Please enter the new value of the key you would like to edit.";
        },
      },
    ]);

    parsedObj[listAnswers.keyToEdit] = inputAnswers.keyEditedValue;

    const encryptedFileInstance = new Cryptify(
      ENCRYPTED_FILE_PATH,
      secretKeyData,
      undefined,
      undefined,
      true,
      true
    );

    fs.writeFileSync(ENCRYPTED_FILE_PATH, JSON.stringify(parsedObj));

    await encryptedFileInstance.encrypt();

    console.log("Done! 🌟");
  } catch (e) {
    console.log("🚫 Cooler-Env 🚫");
  }
};

export default edit;
