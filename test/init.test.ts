import fs from "fs";
import os from "os";
import path from "path";

jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

import inquirer from "inquirer";
import init from "../src/commands/init";
import { makeSandbox, Sandbox } from "./sandbox";

const prompt = inquirer.prompt as unknown as jest.Mock;

describe("init", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
    prompt.mockReset();
  });

  afterEach(() => sandbox.restore());

  it("creates a key file and an encrypted file", async () => {
    await init({ _: [], e: "test" });

    const configDir = path.join(sandbox.dir, "config");
    expect(fs.existsSync(path.join(configDir, "test.key"))).toBe(true);
    expect(fs.existsSync(path.join(configDir, "test.yml.enc"))).toBe(true);
  });

  it("honors a custom config path", async () => {
    await init({ _: [], e: "test", p: "secrets" });

    expect(fs.existsSync(path.join(sandbox.dir, "secrets", "test.key"))).toBe(
      true
    );
  });

  it("creates .gitignore and adds the key exactly once across re-runs", async () => {
    await init({ _: [], e: "test" });
    // Second init on an existing env requires confirmation.
    prompt.mockResolvedValueOnce({ confirmOverwrite: true });
    await init({ _: [], e: "test" });

    const gitignore = fs.readFileSync(
      path.join(sandbox.dir, ".gitignore"),
      "utf8"
    );
    const occurrences = gitignore
      .split(/\r?\n/)
      .filter((line) => line.trim() === "config/test.key").length;

    expect(occurrences).toBe(1);
  });

  it("aborts an overwrite when the user declines", async () => {
    await init({ _: [], e: "test" });
    const originalKey = fs.readFileSync(
      path.join(sandbox.dir, "config", "test.key"),
      "utf8"
    );

    prompt.mockResolvedValueOnce({ confirmOverwrite: false });
    await init({ _: [], e: "test" });

    const keyAfter = fs.readFileSync(
      path.join(sandbox.dir, "config", "test.key"),
      "utf8"
    );
    expect(keyAfter).toBe(originalKey);
  });

  it("rejects a missing environment name", async () => {
    await expect(init({ _: [] })).rejects.toThrow(/valid environment/);
  });

  it("rejects an environment name that escapes the config directory", async () => {
    await expect(init({ _: [], e: "../escape" })).rejects.toThrow(
      /Invalid environment name/
    );
    expect(fs.existsSync(path.join(sandbox.dir, "escape.key"))).toBe(false);
  });

  it("writes a git-matchable .gitignore entry for a messy -p", async () => {
    await init({ _: [], e: "dev", p: "./config/" });

    const gitignore = fs.readFileSync(
      path.join(sandbox.dir, ".gitignore"),
      "utf8"
    );
    expect(gitignore.split(/\r?\n/)).toContain("config/dev.key");
  });

  it("stores files at an absolute -p inside cwd and gitignores them relatively", async () => {
    const abs = path.join(sandbox.dir, "nested", "secrets");
    await init({ _: [], e: "dev", p: abs });

    expect(fs.existsSync(path.join(abs, "dev.key"))).toBe(true);
    const gitignore = fs.readFileSync(
      path.join(sandbox.dir, ".gitignore"),
      "utf8"
    );
    expect(gitignore.split(/\r?\n/)).toContain("nested/secrets/dev.key");
  });

  it("warns instead of gitignoring a key outside cwd", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "coolerenv-out-"));
    const warn = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await init({ _: [], e: "dev", p: outside });

      expect(fs.existsSync(path.join(outside, "dev.key"))).toBe(true);
      expect(fs.existsSync(path.join(sandbox.dir, ".gitignore"))).toBe(false);
      expect(warn.mock.calls.flat().join("\n")).toMatch(/NOT added to .gitignore/);
    } finally {
      warn.mockRestore();
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("appends cleanly to a .gitignore without a trailing newline", async () => {
    fs.writeFileSync(path.join(sandbox.dir, ".gitignore"), "node_modules");
    await init({ _: [], e: "test" });

    const lines = fs
      .readFileSync(path.join(sandbox.dir, ".gitignore"), "utf8")
      .split(/\r?\n/);
    expect(lines).toContain("node_modules");
    expect(lines).toContain("config/test.key");
  });
});
