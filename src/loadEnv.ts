import path from "path";
import fs from "fs";
import Cryptify from "cryptify";

export const loadEnv = async (env: any, configPath = null) => {
  const CONFIG_DIR_PATH = path.join(
    process.cwd(),
    configPath ? configPath : "config"
  );
  const ENCRYPTION_KEY_PATH = path.join(CONFIG_DIR_PATH, `${env}.key`);
  const ENCRYPTED_FILE_PATH = path.join(CONFIG_DIR_PATH, `${env}.yml.enc`);
  const DECRYPTED_FILE_PATH = path.join(
    CONFIG_DIR_PATH,
    `${env}-d.yml.enc.tmp`
  );

  if (!env) {
    throw new Error(
      "Cooler-Env: loadEnv requires a valid environment name to be passed as an argument"
    );
  }

  if (!fs.existsSync(ENCRYPTION_KEY_PATH)) {
    throw new Error(
      `Cooler-Env: Encryption key not found for environment "${env}"`
    );
  }

  if (!fs.existsSync(ENCRYPTED_FILE_PATH)) {
    throw new Error(
      `Cooler-Env: Encrypted file not found for environment "${env}"`
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

  try {
    const files = await decryptedFileInstance.decrypt();

    fs.unlinkSync(DECRYPTED_FILE_PATH);

    if (!files) return;

    const parsedObj = JSON.parse(files[0]);

    Object.keys(parsedObj).forEach((key) => {
      process.env[key] = parsedObj[key];
    });

    return files;
  } catch (e) {
    throw new Error("Cooler-Env: Error loading environment variables");
  }
};
