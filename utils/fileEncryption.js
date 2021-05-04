const crypto = require("crypto");
const fs = require("fs");

const encryptFile = (secretKeyPath, ivPath, newDataToEncrypt) => {
  return new Promise((resolve, reject) => {
    fs.readFile(secretKeyPath, "utf8", (secretKeyErr, secretKeyData) => {
      if (secretKeyErr) {
        return reject("There was a problem reading the secret key \n", secretKeyErr);
      }

      fs.readFile(ivPath, "utf8", (ivErr, ivData) => {
        if (ivErr) {
          return reject("There was a problem reading the IV \n", ivErr);
        }

        const cipher = crypto.createCipheriv("aes-256-ctr", secretKeyData, Buffer.from(ivData, "hex"));

        const encrypted = Buffer.concat([cipher.update(newDataToEncrypt), cipher.final()]);

        return resolve(encrypted.toString('hex'));
      });
    });
  });
}

const decryptFile = (filePath, secretKeyPath, ivPath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (fileErr, fileData) => {
      if (fileErr) {
        return reject("There was a problem reading the encryption file \n", fileErr);
      }

      fs.readFile(secretKeyPath, "utf8", (secretKeyErr, secretKeyData) => {
        if (secretKeyErr) {
          return reject("There was a problem reading the secret key \n", secretKeyErr);
        }
  
        fs.readFile(ivPath, "utf8", (ivErr, ivData) => {
          if (ivErr) {
            return reject("There was a problem reading the IV \n", ivErr);
          }
  
          const decipher = crypto.createDecipheriv("aes-256-ctr", secretKeyData, Buffer.from(ivData, "hex"));

          const decrypted = Buffer.concat([decipher.update(Buffer.from(fileData, "hex")), decipher.final()]);

          return resolve(decrypted.toString());
        });
      });
    });
  });
}

module.exports = {
  encryptFile,
  decryptFile
};
