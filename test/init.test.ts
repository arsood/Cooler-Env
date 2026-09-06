import fs from "fs";
import os from "os";
import path from "path";

jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

import { execFileSync } from "child_process";

import inquirer from "inquirer";
import init from "../src/commands/init";
import { makeSandbox, Sandbox } from "./sandbox";

const prompt = inquirer.prompt as unknown as jest.Mock;

const readGitignore = (dir: string): string[] =>
  fs.readFileSync(path.join(dir, ".gitignore"), "utf8").split(/\r?\n/);

/** Ask git whether `file` (relative to `dir`) is ignored by `dir/.gitignore`. */
const gitIgnores = (dir: string, file: string): boolean => {
  execFileSync("git", ["init", "-q", "."], { cwd: dir });
  try {
    execFileSync("git", ["check-ignore", "-q", file], { cwd: dir });
    return true;
  } catch {
    return false;
  }
};

describe("init", () => {
  let sandbox: Sandbox;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    sandbox = makeSandbox();
    prompt.mockReset();
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    error = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
    error.mockRestore();
    sandbox.restore();
  });

  it("creates a key file and an encrypted file", async () => {
    await init({ _: [], e: "test" });

    const configDir = path.join(sandbox.dir, "config");
    expect(fs.existsSync(path.join(configDir, "test.key"))).toBe(true);
    expect(fs.existsSync(path.join(configDir, "test.yml.enc"))).toBe(true);
  });

  it("honors a custom config path", async () => {
    await init({ _: [], e: "test", p: "secrets" });

    expect(fs.existsSync(path.join(sandbox.dir, "secrets", "test.key"))).toBe(
      true,
    );
  });

  it("creates .gitignore and adds the key exactly once across re-runs", async () => {
    await init({ _: [], e: "test" });
    // Second init on an existing env requires confirmation.
    prompt.mockResolvedValueOnce({ confirmOverwrite: true });
    await init({ _: [], e: "test" });

    const gitignore = fs.readFileSync(
      path.join(sandbox.dir, ".gitignore"),
      "utf8",
    );
    const occurrences = gitignore
      .split(/\r?\n/)
      .filter((line) => line.trim() === "/config/test.key").length;

    expect(occurrences).toBe(1);
  });

  it("resets the key file to 0600 on re-init even if it was loosened", async () => {
    await init({ _: [], e: "test" });
    const keyFile = path.join(sandbox.dir, "config", "test.key");
    fs.chmodSync(keyFile, 0o644);

    prompt.mockResolvedValueOnce({ confirmOverwrite: true });
    await init({ _: [], e: "test" });

    expect(fs.statSync(keyFile).mode & 0o777).toBe(0o600);
  });

  it("aborts an overwrite when the user declines", async () => {
    await init({ _: [], e: "test" });
    const originalKey = fs.readFileSync(
      path.join(sandbox.dir, "config", "test.key"),
      "utf8",
    );

    prompt.mockResolvedValueOnce({ confirmOverwrite: false });
    await init({ _: [], e: "test" });

    const keyAfter = fs.readFileSync(
      path.join(sandbox.dir, "config", "test.key"),
      "utf8",
    );
    expect(keyAfter).toBe(originalKey);
  });

  it("rejects a missing environment name", async () => {
    await expect(init({ _: [] })).rejects.toThrow(/valid environment/);
  });

  it("rejects an environment name that escapes the config directory", async () => {
    await expect(init({ _: [], e: "../escape" })).rejects.toThrow(
      /Invalid environment name/,
    );
    expect(fs.existsSync(path.join(sandbox.dir, "escape.key"))).toBe(false);
  });

  it("writes an anchored, git-matchable .gitignore entry for a messy -p", async () => {
    await init({ _: [], e: "dev", p: "./config/" });

    expect(readGitignore(sandbox.dir)).toContain("/config/dev.key");
    expect(gitIgnores(sandbox.dir, "config/dev.key")).toBe(true);
  });

  it("stores files at an absolute -p inside cwd and gitignores them relatively", async () => {
    const abs = path.join(sandbox.dir, "nested", "secrets");
    await init({ _: [], e: "dev", p: abs });

    expect(fs.existsSync(path.join(abs, "dev.key"))).toBe(true);
    expect(readGitignore(sandbox.dir)).toContain("/nested/secrets/dev.key");
  });

  it("does not treat a directory named ..foo as outside cwd", async () => {
    await init({ _: [], e: "dev", p: "..foo" });

    expect(readGitignore(sandbox.dir)).toContain("/..foo/dev.key");
    expect(error).not.toHaveBeenCalled();
  });

  it("anchors the entry so -p . only ignores the top-level key", async () => {
    await init({ _: [], e: "dev", p: "." });

    expect(readGitignore(sandbox.dir)).toContain("/dev.key");
    fs.mkdirSync(path.join(sandbox.dir, "sub"));
    fs.writeFileSync(path.join(sandbox.dir, "sub", "dev.key"), "x");
    expect(gitIgnores(sandbox.dir, "dev.key")).toBe(true);
    expect(gitIgnores(sandbox.dir, "sub/dev.key")).toBe(false);
  });

  it.each(["#secrets", "!secrets", "[s]ecrets", "sec*rets", "who?", "sp ace"])(
    "escapes gitignore metacharacters in -p %j so git matches the key",
    async (dir) => {
      await init({ _: [], e: "dev", p: dir });

      expect(gitIgnores(sandbox.dir, `${dir}/dev.key`)).toBe(true);
    },
  );

  it("escapes metacharacters in the environment name too", async () => {
    await init({ _: [], e: "a#b" });

    expect(gitIgnores(sandbox.dir, "config/a#b.key")).toBe(true);
  });

  it("warns instead of gitignoring a key outside cwd", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "coolerenv-out-"));

    try {
      await init({ _: [], e: "dev", p: outside });

      expect(fs.existsSync(path.join(outside, "dev.key"))).toBe(true);
      expect(fs.existsSync(path.join(sandbox.dir, ".gitignore"))).toBe(false);
      expect(error.mock.calls.flat().join("\n")).toMatch(
        /NOT added to .gitignore/,
      );
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("warns when cwd is not inside a git repository", async () => {
    // The sandbox is marked as a repo root; drop the marker so cwd has no
    // `.git` at or above it.
    fs.rmSync(path.join(sandbox.dir, ".git"), { recursive: true, force: true });

    await init({ _: [], e: "dev" });

    // The .gitignore is still written (speculative protection), but a warning
    // flags that git won't honor it here.
    expect(readGitignore(sandbox.dir)).toContain("/config/dev.key");
    expect(error.mock.calls.flat().join("\n")).toMatch(
      /no git repository found/,
    );
  });

  it("does not warn about a missing repo when cwd is inside one", async () => {
    // The sandbox already carries a `.git` marker, so init should stay quiet.
    await init({ _: [], e: "dev" });

    expect(error.mock.calls.flat().join("\n")).not.toMatch(
      /no git repository found/,
    );
  });

  it("warns and still completes when .gitignore cannot be written", async () => {
    fs.mkdirSync(path.join(sandbox.dir, ".gitignore")); // a directory, not a file

    await init({ _: [], e: "dev" });

    expect(fs.existsSync(path.join(sandbox.dir, "config", "dev.yml.enc"))).toBe(
      true,
    );
    expect(error.mock.calls.flat().join("\n")).toMatch(
      /could not update .gitignore/,
    );
  });

  it("does not duplicate an unanchored entry written by an earlier version", async () => {
    fs.writeFileSync(path.join(sandbox.dir, ".gitignore"), "config/test.key\n");
    await init({ _: [], e: "test" });

    expect(
      readGitignore(sandbox.dir).filter((l) => l.endsWith("test.key")),
    ).toEqual(["config/test.key"]);
  });

  it("appends cleanly to a .gitignore without a trailing newline", async () => {
    fs.writeFileSync(path.join(sandbox.dir, ".gitignore"), "node_modules");
    await init({ _: [], e: "test" });

    const lines = fs
      .readFileSync(path.join(sandbox.dir, ".gitignore"), "utf8")
      .split(/\r?\n/);
    expect(lines).toContain("node_modules");
    expect(lines).toContain("/config/test.key");
  });
});
