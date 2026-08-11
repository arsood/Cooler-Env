jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

import fs from "fs";
import path from "path";

import inquirer from "inquirer";
import init from "../src/commands/init";
import add from "../src/commands/add";
import { loadEnv } from "../src/loadEnv";
import { makeSandbox, Sandbox } from "./sandbox";

const prompt = inquirer.prompt as unknown as jest.Mock;
const ENV = { _: [], e: "test" };

describe("loadEnv", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
    prompt.mockReset();
  });

  afterEach(() => {
    sandbox.restore();
    delete process.env.TOKEN;
  });

  it("throws without an environment name", async () => {
    await expect(loadEnv("")).rejects.toThrow(/valid environment name/);
  });

  it("throws when the environment is not initialized", async () => {
    await expect(loadEnv("test")).rejects.toThrow(/Encryption key not found/);
  });

  it("returns secrets without touching process.env by default", async () => {
    await init(ENV);
    prompt.mockResolvedValueOnce({ keyName: "TOKEN", keyValue: "abc123" });
    await add(ENV);

    const secrets = await loadEnv("test");

    expect(secrets.TOKEN).toBe("abc123");
    expect(process.env.TOKEN).toBeUndefined();
  });

  it("injects into process.env when asked, and leaves no temp files", async () => {
    await init(ENV);
    prompt.mockResolvedValueOnce({ keyName: "TOKEN", keyValue: "abc123" });
    await add(ENV);

    await loadEnv("test", { inject: true });

    const leftovers = fs
      .readdirSync(path.join(sandbox.dir, "config"))
      .filter((f) => f.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
    expect(process.env.TOKEN).toBe("abc123");
  });

  it("does not override an already-set variable unless told to", async () => {
    await init(ENV);
    prompt.mockResolvedValueOnce({ keyName: "TOKEN", keyValue: "abc123" });
    await add(ENV);

    process.env.TOKEN = "preset";
    await loadEnv("test", { inject: true });
    expect(process.env.TOKEN).toBe("preset");

    await loadEnv("test", { inject: true, override: true });
    expect(process.env.TOKEN).toBe("abc123");
  });
});
