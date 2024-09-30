"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const clear_1 = __importDefault(require("clear"));
const chalk_1 = __importDefault(require("chalk"));
const figlet_1 = __importDefault(require("figlet"));
const cryptify_1 = __importDefault(require("cryptify"));
const add = (argv) => {
    const CONFIG_DIR_PATH = path_1.default.join(process.cwd(), argv.p ? argv.p : "config");
    const ENCRYPTION_KEY_PATH = path_1.default.join(CONFIG_DIR_PATH, `${argv.e}.key`);
    const ENCRYPTED_FILE_PATH = path_1.default.join(CONFIG_DIR_PATH, `${argv.e}.yml.enc`);
    const DECRYPTED_FILE_PATH = path_1.default.join(CONFIG_DIR_PATH, `${argv.e}-d.yml.enc.tmp`);
    (0, clear_1.default)();
    console.log(chalk_1.default.green(figlet_1.default.textSync("Cooler Env", { horizontalLayout: "full" })));
    if (!argv.e) {
        return console.log(chalk_1.default.red("Please enter a valid environment with the -e option"));
    }
    if (!fs_1.default.existsSync(ENCRYPTION_KEY_PATH)) {
        return console.log(chalk_1.default.red(`Encryption key not found for environment "${argv.e}"`));
    }
    if (!fs_1.default.existsSync(ENCRYPTED_FILE_PATH)) {
        return console.log(chalk_1.default.red(`Encrypted file not found for environment "${argv.e}"`));
    }
    inquirer_1.default
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
            },
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
            },
        },
    ])
        .then((answers) => {
        fs_1.default.copyFileSync(ENCRYPTED_FILE_PATH, DECRYPTED_FILE_PATH);
        const secretKeyData = fs_1.default.readFileSync(ENCRYPTION_KEY_PATH).toString();
        const decryptedFileInstance = new cryptify_1.default(DECRYPTED_FILE_PATH, secretKeyData, undefined, undefined, true, true);
        decryptedFileInstance
            .decrypt()
            .then((files) => {
            fs_1.default.unlinkSync(DECRYPTED_FILE_PATH);
            if (!files)
                return;
            const parsedObj = JSON.parse(files[0]);
            if (parsedObj[answers.keyName]) {
                return console.log(chalk_1.default.red("The key exists already. Try editing instead?"));
            }
            parsedObj[answers.keyName] = answers.keyValue;
            fs_1.default.writeFileSync(ENCRYPTED_FILE_PATH, JSON.stringify(parsedObj));
            const encryptedFileInstance = new cryptify_1.default(ENCRYPTED_FILE_PATH, secretKeyData, undefined, undefined, true, true);
            encryptedFileInstance.encrypt();
        })
            .then(() => {
            console.log("Done! 🌟");
        });
    });
};
exports.default = add;
