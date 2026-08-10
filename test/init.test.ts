import fs from "fs";
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
});
