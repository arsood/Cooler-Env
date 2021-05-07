const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const crypto = require("crypto");
const Cryptify = require("cryptify");
const clear = require("clear");
const figlet = require("figlet");

const init = (argv) => {
  const ENCRYPTION_KEY_PATH = path.join(process.cwd(), `config/${argv.e}.key`);
  const ENCRYPTED_FILE_PATH = path.join(process.cwd(), `config/${argv.e}.yml.enc`);
  const CONFIG_DIR_PATH = path.join(process.cwd(), "config");

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

  fs.writeFile(ENCRYPTION_KEY_PATH, newKey, (mkfileErr) => {
    if (mkfileErr) {
      return console.log(chalk.red("There was an error writing the appropriate files \n\n"), mkfileErr);
    }
  });

  fs.writeFile(ENCRYPTED_FILE_PATH, "{}", (mkfileErr) => {
    if (mkfileErr) {
      return console.log(chalk.red("There was an error writing the appropriate files \n\n"), mkfileErr);
    }

    const encryptedFileInstance = new Cryptify(ENCRYPTED_FILE_PATH, newKey, null, null, true, true);

    encryptedFileInstance.encrypt();
  });

  console.log("Init complete! 💯");
}

module.exports = init;
