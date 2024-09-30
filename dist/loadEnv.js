"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cryptify_1 = __importDefault(require("cryptify"));
const loadEnv = (env, configPath = null) => {
    const CONFIG_DIR_PATH = path_1.default.join(process.cwd(), configPath ? configPath : "config");
    const ENCRYPTION_KEY_PATH = path_1.default.join(CONFIG_DIR_PATH, `${env}.key`);
    const ENCRYPTED_FILE_PATH = path_1.default.join(CONFIG_DIR_PATH, `${env}.yml.enc`);
    const DECRYPTED_FILE_PATH = path_1.default.join(CONFIG_DIR_PATH, `${env}-d.yml.enc.tmp`);
    if (!env) {
        throw new Error("loadEnv requires a valid environment name to be passed as an argument");
    }
    if (!fs_1.default.existsSync(ENCRYPTION_KEY_PATH)) {
        throw new Error(`Encryption key not found for environment "${env}"`);
    }
    if (!fs_1.default.existsSync(ENCRYPTED_FILE_PATH)) {
        throw new Error(`Encrypted file not found for environment "${env}"`);
    }
    fs_1.default.copyFileSync(ENCRYPTED_FILE_PATH, DECRYPTED_FILE_PATH);
    const secretKeyData = fs_1.default.readFileSync(ENCRYPTION_KEY_PATH).toString();
    const decryptedFileInstance = new cryptify_1.default(DECRYPTED_FILE_PATH, secretKeyData, undefined, undefined, true, true);
    return decryptedFileInstance.decrypt().then((files) => {
        fs_1.default.unlinkSync(DECRYPTED_FILE_PATH);
        if (!files)
            return;
        const parsedObj = JSON.parse(files[0]);
        Object.keys(parsedObj).forEach((key) => {
            process.env[key] = parsedObj[key];
        });
    });
};
module.exports = loadEnv;
