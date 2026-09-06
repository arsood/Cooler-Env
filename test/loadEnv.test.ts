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

  let log: jest.SpyInstance;

  beforeEach(() => {
    sandbox = makeSandbox();
    prompt.mockReset();
    log = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
    sandbox.restore();
    delete process.env.TOKEN;
  });

  it("throws without an environment name", async () => {
    await expect(loadEnv("")).rejects.toThrow(/valid environment name/);
    await expect(loadEnv(undefined as unknown as string)).rejects.toThrow(
      /valid environment name/
    );
  });

  it("rejects an environment name that escapes the config directory", async () => {
    await expect(loadEnv("../etc")).rejects.toThrow(/Invalid environment name/);
    await expect(loadEnv("a/b")).rejects.toThrow(/Invalid environment name/);
  });

  it("accepts an absolute configPath", async () => {
    const abs = path.join(sandbox.dir, "elsewhere");
    await init({ _: [], e: "test", p: abs });
    prompt.mockResolvedValueOnce({ keyName: "TOKEN", keyValue: "abc123" });
    await add({ _: [], e: "test", p: abs });

    const secrets = await loadEnv("test", { configPath: abs });
    expect(secrets.TOKEN).toBe("abc123");
  });

  it("exports CoolerEnvError so callers can instanceof it", async () => {
    const { CoolerEnvError } = await import("../src/index");
    await expect(loadEnv("test")).rejects.toBeInstanceOf(CoolerEnvError);
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
