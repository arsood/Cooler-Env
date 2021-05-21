const fs = require("fs");
const path = require("path");
const rimrafSync = require("rimraf").sync;
const expect = require("chai").expect;

const init = require("../commands/init");

describe("Init", () => {
  it("Should create a key file and a .enc file after init", (done) => {
    init({
      p: "test_dir",
      e: "test",
    }).then(() => {
      const TEST_DIR = path.join(process.cwd(), "test_dir");

      const dirExists = fs.existsSync(TEST_DIR);
      const keyFileExists = fs.existsSync(path.join(TEST_DIR, "test.key"));
      const encFileExists = fs.existsSync(path.join(TEST_DIR, "test.yml.enc"));

      expect(dirExists).to.be.true;
      expect(keyFileExists).to.be.true;
      expect(encFileExists).to.be.true;

      rimrafSync(path.join(process.cwd(), "test_dir"));

      done();
    });
  });
});
