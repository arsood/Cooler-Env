jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

import fs from "fs";
import path from "path";

import inquirer from "inquirer";
import { run } from "../src/run";
import { makeSandbox, Sandbox } from "./sandbox";

const prompt = inquirer.prompt as unknown as jest.Mock;

describe("run (CLI dispatch)", () => {
  let sandbox: Sandbox;

  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    sandbox = makeSandbox();
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    error = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
    error.mockRestore();
    sandbox.restore();
  });

  it("rejects a missing command", async () => {
    await expect(run([])).rejects.toThrow(/valid command/);
  });

  it("rejects an unknown command", async () => {
    await expect(run(["bogus", "-e", "x"])).rejects.toThrow(/valid command/);
  });

  it("does not resolve Object.prototype members as commands", async () => {
    await expect(run(["constructor", "-e", "x"])).rejects.toThrow(
      /valid command/,
    );
    await expect(run(["toString", "-e", "x"])).rejects.toThrow(/valid command/);
  });

  it("keeps numeric-looking -e / -p values as strings", async () => {
    await run(["init", "-e", "123", "-p", "456"]);

    expect(fs.existsSync(path.join(sandbox.dir, "456", "123.key"))).toBe(true);
  });

  it("rejects a bare -e with no value", async () => {
    await expect(run(["init", "-e"])).rejects.toThrow(/-e option/);
    await expect(run(["init", "-e", "-p", "x"])).rejects.toThrow(/-e option/);
    await expect(run(["init", "--no-e"])).rejects.toThrow(/-e option/);
  });

  it("rejects a repeated -e instead of joining the values", async () => {
    await expect(run(["init", "-e", "a", "-e", "b"])).rejects.toThrow(
      /only once/,
    );
    expect(fs.existsSync(path.join(sandbox.dir, "config"))).toBe(false);
  });

  it("rejects a bare -p instead of silently using config/", async () => {
    await expect(run(["init", "-e", "dev", "-p"])).rejects.toThrow(
      /-p option requires/,
    );
    await expect(run(["init", "-e", "dev", "-p", "-x"])).rejects.toThrow(
      /-p option requires/,
    );
    expect(fs.existsSync(path.join(sandbox.dir, "config"))).toBe(false);
  });

  it("parses --show as a boolean flag and passes it to the command", async () => {
    prompt.mockReset();
    await run(["init", "-e", "t"]); // fresh init: no prompt
    prompt.mockResolvedValueOnce({ keyName: "FOO", keyValue: "bar" });

    await run(["add", "-e", "t", "--show"]);

    // --show flips the value prompt to a visible `input`; seeing that here
    // proves minimist parsed the bare flag and `add` received `show: true`.
    const questions = prompt.mock.calls.at(-1)?.[0];
    const valueQ = questions.find(
      (q: { name: string }) => q.name === "keyValue",
    );
    expect(valueQ.type).toBe("input");
  });

  // Read the version independently of getVersion() so the assertion can't pass
  // by both sides returning "unknown".
  const pkgVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
  ).version as string;

  it("prints the package version for --version", async () => {
    await run(["--version"]);

    expect(log).toHaveBeenCalledWith(pkgVersion);
    expect(pkgVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("no longer treats -v as --version (it is the add value)", async () => {
    // -v carries a value now; with no command it falls through to the usual
    // error rather than printing the version.
    await expect(run(["-v", "x"])).rejects.toThrow(/valid command/);
    expect(log).not.toHaveBeenCalledWith(pkgVersion);
  });

  it("prints the version and dispatches no command when combined", async () => {
    await run(["init", "-e", "t", "--version"]);

    expect(log).toHaveBeenCalledWith(pkgVersion);
    // init did not run, so no config dir was created.
    expect(fs.existsSync(path.join(sandbox.dir, "config"))).toBe(false);
  });

  it.each([["--help"], ["-h"]])("prints usage for %s", async (flag) => {
    await run([flag]);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("warns on an unknown option but still runs the command", async () => {
    await run(["init", "-e", "t", "--bogus"]);

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("unknown option --bogus"),
    );
    expect(fs.existsSync(path.join(sandbox.dir, "config", "t.key"))).toBe(true);
  });

  it("warns on an unexpected positional argument", async () => {
    await run(["init", "-e", "t", "extra"]);

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('unexpected argument "extra"'),
    );
  });

  it("treats list as a valid command", async () => {
    await expect(run(["list", "-e"])).rejects.toThrow(/-e option/);
  });

  it("treats export as a valid command", async () => {
    await expect(run(["export", "-e"])).rejects.toThrow(/-e option/);
  });

  it("accepts --shell on export without warning about an unknown option", async () => {
    await run(["init", "-e", "t"]);
    error.mockClear();
    await run(["export", "-e", "t", "--shell"]);

    expect(error).not.toHaveBeenCalledWith(
      expect.stringContaining("unknown option"),
    );
  });
});
