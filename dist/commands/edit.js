"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const edit = (argv) => __awaiter(void 0, void 0, void 0, function* () {
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
    fs_1.default.copyFileSync(ENCRYPTED_FILE_PATH, DECRYPTED_FILE_PATH);
    const secretKeyData = fs_1.default.readFileSync(ENCRYPTION_KEY_PATH).toString();
    const decryptedFileInstance = new cryptify_1.default(DECRYPTED_FILE_PATH, secretKeyData, undefined, undefined, true, true);
    const files = yield decryptedFileInstance.decrypt();
    fs_1.default.unlinkSync(DECRYPTED_FILE_PATH);
    if (!files)
        return;
    const parsedObj = JSON.parse(files[0]);
    if (Object.keys(parsedObj).length === 0) {
        return console.log(chalk_1.default.red("Nothing to edit. Please add some keys first."));
    }
    try {
        const listAnswers = yield inquirer_1.default.prompt([
            {
                name: "keyToEdit",
                type: "list",
                message: "Which key would you like to edit?",
                choices: Object.keys(parsedObj),
            },
        ]);
        const inputAnswers = yield inquirer_1.default.prompt([
            {
                name: "keyEditedValue",
                type: "input",
                message: "What is the new value of this key?",
                default: parsedObj[listAnswers.keyToEdit],
                validate: (value) => {
                    if (value.length) {
                        return true;
                    }
                    return "Please enter the new value of the key you would like to edit.";
                },
            },
        ]);
        parsedObj[listAnswers.keyToEdit] = inputAnswers.keyEditedValue;
        const encryptedFileInstance = new cryptify_1.default(ENCRYPTED_FILE_PATH, secretKeyData, undefined, undefined, true, true);
        fs_1.default.writeFileSync(ENCRYPTED_FILE_PATH, JSON.stringify(parsedObj));
        yield encryptedFileInstance.encrypt();
        console.log("Done! 🌟");
    }
    catch (e) {
        console.log("🚫 Cooler-Env 🚫");
    }
});
exports.default = edit;
