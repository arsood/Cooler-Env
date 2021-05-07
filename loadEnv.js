const path = require("path");
const fs = require("fs");
const Cryptify = require("cryptify");

const loadEnv = (env) => {
  const ENCRYPTION_KEY_PATH = path.join(process.cwd(), `config/${env}.key`);
  const ENCRYPTED_FILE_PATH = path.join(process.cwd(), `config/${env}.yml.enc`);

  if (!env) {
    throw new Error("loadEnv requires a valid environment name to be passed as an argument");
  }

  if (!fs.existsSync(ENCRYPTION_KEY_PATH)) {
    throw new Error(`Encryption key not found for environment "${env}"`);
  }

  if (!fs.existsSync(ENCRYPTED_FILE_PATH)) {
    throw new Error(`Encrypted file not found for environment "${env}"`);
  }

  const secretKeyData = fs
  .readFileSync(ENCRYPTION_KEY_PATH)
  .toString();

  const encryptedFileInstance = new Cryptify(ENCRYPTED_FILE_PATH, secretKeyData, null, null, true, true);

  encryptedFileInstance
  .decrypt()
  .then((files) => {
    const parsedObj = JSON.parse(files[0]);

    Object.keys(parsedObj).forEach((key) => {
      process.env[key] = parsedObj[key];
    });
  })
  .then(() => {
    encryptedFileInstance.encrypt();
  });
}

module.exports = loadEnv;
