import fs from "fs";
import path from "path";
import chalk from "chalk";
import crypto from "crypto";
import Cryptify from "cryptify";
import clear from "clear";
import figlet from "figlet";

type ArgumentType = {
  [key: string]: string;
};

const init = async (argv: ArgumentType) => {
  const CONFIG_DIR_PATH = path.join(process.cwd(), argv.p ? argv.p : "config");
  const ENCRYPTION_KEY_PATH = path.join(CONFIG_DIR_PATH, `${argv.e}.key`);
  const ENCRYPTED_FILE_PATH = path.join(CONFIG_DIR_PATH, `${argv.e}.yml.enc`);
  const GITIGNORE_PATH = path.join(process.cwd(), ".gitignore");

  clear();

  console.log(
    chalk.green(figlet.textSync("Cooler Env", { horizontalLayout: "full" }))
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

  // Add key file to .gitignore
  if (fs.existsSync(GITIGNORE_PATH)) {
    fs.appendFileSync(
      GITIGNORE_PATH,
      `\n\n# Cooler-Env secret key\n${argv.p ? argv.p : "config"}/${
        argv.e
      }.key\n`
    );

    console.log(chalk.green("Appending .key file to .gitignore"));
  } else {
    console.log(
      chalk.red(
        "WARNING: DO NOT CHECK THE .KEY FILE INTO VERSION CONTROL OTHERWISE YOUR KEYS CAN BE DECRYPTED AND EXPOSED."
      )
    );
  }

  fs.writeFileSync(ENCRYPTED_FILE_PATH, "{}");

  console.log(chalk.green(`Writing encrypted file to: ${ENCRYPTED_FILE_PATH}`));

  const encryptedFileInstance = new Cryptify(
    ENCRYPTED_FILE_PATH,
    newKey,
    undefined,
    undefined,
    true,
    true
  );

  console.log("Init complete! 💯");

  return await encryptedFileInstance.encrypt();
};

export default init;
