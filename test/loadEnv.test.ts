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

  it("leaves no plaintext temp files behind after loading", async () => {
    await init(ENV);
    prompt.mockResolvedValueOnce({ keyName: "TOKEN", keyValue: "abc123" });
    await add(ENV);

    await loadEnv("test");

    const leftovers = fs
      .readdirSync(path.join(sandbox.dir, "config"))
      .filter((f) => f.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
    expect(process.env.TOKEN).toBe("abc123");
  });
});
