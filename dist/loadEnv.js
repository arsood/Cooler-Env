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
exports.loadEnv = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cryptify_1 = __importDefault(require("cryptify"));
const loadEnv = (env, configPath = null) => __awaiter(void 0, void 0, void 0, function* () {
    const CONFIG_DIR_PATH = path_1.default.join(process.cwd(), configPath ? configPath : "config");
    const ENCRYPTION_KEY_PATH = path_1.default.join(CONFIG_DIR_PATH, `${env}.key`);
    const ENCRYPTED_FILE_PATH = path_1.default.join(CONFIG_DIR_PATH, `${env}.yml.enc`);
    const DECRYPTED_FILE_PATH = path_1.default.join(CONFIG_DIR_PATH, `${env}-d.yml.enc.tmp`);
    if (!env) {
        throw new Error("Cooler-Env: loadEnv requires a valid environment name to be passed as an argument");
    }
    if (!fs_1.default.existsSync(ENCRYPTION_KEY_PATH)) {
        throw new Error(`Cooler-Env: Encryption key not found for environment "${env}"`);
    }
    if (!fs_1.default.existsSync(ENCRYPTED_FILE_PATH)) {
        throw new Error(`Cooler-Env: Encrypted file not found for environment "${env}"`);
    }
    fs_1.default.copyFileSync(ENCRYPTED_FILE_PATH, DECRYPTED_FILE_PATH);
    const secretKeyData = fs_1.default.readFileSync(ENCRYPTION_KEY_PATH).toString();
    const decryptedFileInstance = new cryptify_1.default(DECRYPTED_FILE_PATH, secretKeyData, undefined, undefined, true, true);
    try {
        const files = yield decryptedFileInstance.decrypt();
        fs_1.default.unlinkSync(DECRYPTED_FILE_PATH);
        if (!files)
            return;
        const parsedObj = JSON.parse(files[0]);
        Object.keys(parsedObj).forEach((key) => {
            process.env[key] = parsedObj[key];
        });
        return files;
    }
    catch (e) {
        throw new Error("Cooler-Env: Error loading environment variables");
    }
});
exports.loadEnv = loadEnv;
