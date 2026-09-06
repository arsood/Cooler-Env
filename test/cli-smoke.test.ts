import { execFileSync, execSync } from "child_process";
import path from "path";

import { resolvePaths } from "../src/lib/paths";
import { writeSecrets } from "../src/lib/secrets";
import { makeSandbox, Sandbox } from "./sandbox";

// These tests drive the *compiled* CLI as a subprocess, so the real `inquirer`
// is loaded (every other suite mocks it). That is the only way to catch two
// classes of breakage that pass `tsc` and mocked unit tests:
//   - module-format failures: an ESM-only inquirer makes `require("inquirer")`
//     throw ERR_REQUIRE_ESM at load time on Node without unflagged require(ESM).
//   - prompt-type failures: a removed legacy prompt type (e.g. `list`) throws
//     "... is not registered" when the prompt is set up.
// The prompts themselves can't complete under a piped (non-TTY) stdin, which is
// fine — we only assert that these specific failure signatures never appear.

const ROOT = path.join(__dirname, "..");
const CLI = path.join(ROOT, "dist", "cli.js");

interface CliResult {
  output: string;
  status: number | null;
}

const runCli = (args: string[], cwd: string): CliResult => {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd,
      input: "", // closed stdin: any prompt aborts immediately
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { output: stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      output: `${e.stdout ?? ""}${e.stderr ?? ""}`,
      status: e.status ?? null,
    };
  }
};

const FATAL = /ERR_REQUIRE_ESM|not registered|is not a function/i;

describe("compiled CLI smoke (real inquirer)", () => {
  let sandbox: Sandbox;

  beforeAll(() => {
    // Build once so dist/ matches src/. CI builds before testing, but this
    // keeps the suite correct when run on its own.
    execSync("yarn build", { cwd: ROOT, stdio: "ignore" });
  }, 120_000);

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("loads its modules and dispatches (no ERR_REQUIRE_ESM)", () => {
    // A bad command needs no prompt: reaching the "valid command" error proves
    // every module — inquirer included — was required successfully.
    const { output } = runCli(["definitely-not-a-command"], sandbox.dir);

    expect(output).toContain("valid command");
    expect(output).not.toMatch(FATAL);
  });

  it("renders the add prompt without a fatal error", () => {
    expect(runCli(["init", "-e", "t"], sandbox.dir).status).toBe(0);

    const { output } = runCli(["add", "-e", "t"], sandbox.dir);
    expect(output).not.toMatch(FATAL);
  });

  it("renders the edit key-picker prompt without a fatal error", async () => {
    expect(runCli(["init", "-e", "t"], sandbox.dir).status).toBe(0);
    // Seed a key so `edit` reaches the key-picker prompt (the one that used the
    // removed-in-inquirer-13 `list` type).
    await writeSecrets(resolvePaths("t"), { FOO: "bar" });

    const { output } = runCli(["edit", "-e", "t"], sandbox.dir);
    expect(output).not.toMatch(FATAL);
  });
});
