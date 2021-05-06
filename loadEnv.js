const loadEnv = (env) => {
  const secretKeyData = fs
  .readFileSync(path.join(__dirname, `./config/${env}.key`))
  .toString();

  const encryptedFileInstance = new Cryptify(path.join(__dirname, `../config/${env}.yml.enc`), secretKeyData, null, null, true, true);

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
