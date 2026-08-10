import fs from "fs";
import os from "os";
import path from "path";
import { rimrafSync } from "rimraf";

export interface Sandbox {
  dir: string;
  restore: () => void;
}

/**
 * Create an isolated temp directory and chdir into it so commands (which are
 * rooted at process.cwd()) operate entirely inside it — never touching the
 * real repo, its .gitignore, or the developer's config.
 */
export const makeSandbox = (): Sandbox => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coolerenv-"));
  const previousCwd = process.cwd();
  process.chdir(dir);

  return {
    dir,
    restore: () => {
      process.chdir(previousCwd);
      rimrafSync(dir);
    },
  };
};
