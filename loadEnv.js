const loadEnv = (env) => {
  const ENCRYPTION_KEY_PATH = path.join(__dirname, `../config/${env}.key`);
  const ENCRYPTED_FILE_PATH = path.join(__dirname, `../config/${env}.yml.enc`);

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
