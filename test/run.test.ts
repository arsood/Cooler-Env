jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

import fs from "fs";
import path from "path";

import { run } from "../src/run";
import { makeSandbox, Sandbox } from "./sandbox";

describe("run (CLI dispatch)", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => sandbox.restore());

  it("rejects a missing command", async () => {
    await expect(run([])).rejects.toThrow(/valid command/);
  });

  it("rejects an unknown command", async () => {
    await expect(run(["bogus", "-e", "x"])).rejects.toThrow(/valid command/);
  });

  it("does not resolve Object.prototype members as commands", async () => {
    await expect(run(["constructor", "-e", "x"])).rejects.toThrow(
      /valid command/
    );
    await expect(run(["toString", "-e", "x"])).rejects.toThrow(
      /valid command/
    );
  });

  it("keeps numeric-looking -e / -p values as strings", async () => {
    await run(["init", "-e", "123", "-p", "456"]);

    expect(fs.existsSync(path.join(sandbox.dir, "456", "123.key"))).toBe(true);
  });

  it("rejects a bare -e with no value", async () => {
    await expect(run(["init", "-e"])).rejects.toThrow(/-e option/);
  });
});
