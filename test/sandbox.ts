import fs from "fs";
import os from "os";
import path from "path";

export interface Sandbox {
  dir: string;
  restore: () => void;
}

const CEILING = "GIT_CEILING_DIRECTORIES";

/**
 * Create an isolated temp directory and chdir into it so commands (which are
 * rooted at process.cwd()) operate entirely inside it — never touching the
 * real repo, its .gitignore, or the developer's config.
 */
export const makeSandbox = (): Sandbox => {
  // realpath so `dir` matches process.cwd() on macOS, where the temp dir is
  // a symlink (/var -> /private/var).
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "coolerenv-")),
  );
  // Mark the sandbox as a git repo root so `init` treats it the way a real
  // project root behaves (its `.gitignore` protects the key). A bare `.git`
  // marker is enough for the walk-up check; tests that need a real repo run
  // their own `git init`, which populates this directory.
  fs.mkdirSync(path.join(dir, ".git"));
  const previousCwd = process.cwd();
  process.chdir(dir);

  // Bound `init`'s walk up the tree at the sandbox's parent so it can never
  // reach a real `.git` above the temp dir (e.g. a git-tracked $HOME or a
  // TMPDIR pointed inside a repo), which would otherwise make the
  // missing-repo test host-dependent.
  const previousCeiling = process.env[CEILING];
  process.env[CEILING] = path.dirname(dir);

  return {
    dir,
    restore: () => {
      if (previousCeiling === undefined) delete process.env[CEILING];
      else process.env[CEILING] = previousCeiling;
      process.chdir(previousCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
};
