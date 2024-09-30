import fs from "fs";
import path from "path";
import { rimrafSync } from "rimraf";

import init from "../src/commands/init";

describe("Init", () => {
  it("Should create a key file and a .enc file after init", async () => {
    try {
      await init({
        p: "test_dir",
        e: "test",
      });

      const TEST_DIR = path.join(process.cwd(), "test_dir");

      const dirExists = fs.existsSync(TEST_DIR);
      const keyFileExists = fs.existsSync(path.join(TEST_DIR, "test.key"));
      const encFileExists = fs.existsSync(path.join(TEST_DIR, "test.yml.enc"));

      expect(dirExists).toBe(true);
      expect(keyFileExists).toBe(true);
      expect(encFileExists).toBe(true);

      rimrafSync(path.join(process.cwd(), "test_dir"));
    } catch (e) {
      console.log(e);
    }
  });
});
