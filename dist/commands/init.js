"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const crypto_1 = __importDefault(require("crypto"));
const cryptify_1 = __importDefault(require("cryptify"));
const clear_1 = __importDefault(require("clear"));
const figlet_1 = __importDefault(require("figlet"));
const init = (argv) => {
    const CONFIG_DIR_PATH = path_1.default.join(process.cwd(), argv.p ? argv.p : "config");
    const ENCRYPTION_KEY_PATH = path_1.default.join(CONFIG_DIR_PATH, `${argv.e}.key`);
    const ENCRYPTED_FILE_PATH = path_1.default.join(CONFIG_DIR_PATH, `${argv.e}.yml.enc`);
    const GITIGNORE_PATH = path_1.default.join(process.cwd(), ".gitignore");
    (0, clear_1.default)();
    console.log(chalk_1.default.green(figlet_1.default.textSync("Cooler Env", { horizontalLayout: "full" })));
    if (!argv.e) {
        return console.log(chalk_1.default.red("Please enter a valid environment with the -e option"));
    }
    if (!fs_1.default.existsSync(CONFIG_DIR_PATH)) {
        fs_1.default.mkdirSync(CONFIG_DIR_PATH);
    }
    const newKey = crypto_1.default.randomBytes(16).toString("hex");
    fs_1.default.writeFileSync(ENCRYPTION_KEY_PATH, newKey);
    console.log(chalk_1.default.green(`Writing encryption key to: ${ENCRYPTION_KEY_PATH}`));
    // Add key file to .gitignore
    if (fs_1.default.existsSync(GITIGNORE_PATH)) {
        fs_1.default.appendFileSync(GITIGNORE_PATH, `\n\n# Cooler-Env secret key\n${argv.p ? argv.p : "config"}/${argv.e}.key\n`);
        console.log(chalk_1.default.green("Appending .key file to .gitignore"));
    }
    else {
        console.log(chalk_1.default.red("WARNING: DO NOT CHECK THE .KEY FILE INTO VERSION CONTROL OTHERWISE YOUR KEYS CAN BE DECRYPTED AND EXPOSED."));
    }
    fs_1.default.writeFileSync(ENCRYPTED_FILE_PATH, "{}");
    console.log(chalk_1.default.green(`Writing encrypted file to: ${ENCRYPTED_FILE_PATH}`));
    const encryptedFileInstance = new cryptify_1.default(ENCRYPTED_FILE_PATH, newKey, undefined, undefined, true, true);
    console.log("Init complete! 💯");
    return encryptedFileInstance.encrypt();
};
exports.default = init;
