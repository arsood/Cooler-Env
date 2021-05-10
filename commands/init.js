const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const crypto = require("crypto");
const Cryptify = require("cryptify");
const clear = require("clear");
const figlet = require("figlet");

const init = (argv) => {
  const CONFIG_DIR_PATH = path.join(process.cwd(), argv.p ? argv.p : "config");
  const ENCRYPTION_KEY_PATH = path.join(CONFIG_DIR_PATH, `${argv.e}.key`);
  const ENCRYPTED_FILE_PATH = path.join(CONFIG_DIR_PATH, `${argv.e}.yml.enc`);

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

  if (!fs.existsSync(CONFIG_DIR_PATH)) {
    fs.mkdirSync(CONFIG_DIR_PATH);
  }

  const newKey = crypto.randomBytes(16).toString("hex");

  fs.writeFileSync(ENCRYPTION_KEY_PATH, newKey);
  
  console.log(chalk.green(`Writing encryption key to: ${ENCRYPTION_KEY_PATH}`));
  
  console.log(chalk.red(`WARNING: DO NOT CHECK THE .KEY FILE INTO VERSION CONTROL. PLEASE ADD TO GITIGNORE OTHERWISE YOUR KEYS CAN BE DECRYPTED AND EXPOSED.`));

  fs.writeFileSync(ENCRYPTED_FILE_PATH, "{}");

  console.log(chalk.green(`Writing encrypted file to: ${ENCRYPTED_FILE_PATH}`));

  const encryptedFileInstance = new Cryptify(ENCRYPTED_FILE_PATH, newKey, null, null, true, true);

  encryptedFileInstance.encrypt();

  console.log("Init complete! 💯");
}

module.exports = init;
