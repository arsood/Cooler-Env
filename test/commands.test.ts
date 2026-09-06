jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { parseEnv } from "util";

import inquirer from "inquirer";
import init from "../src/commands/init";
import add from "../src/commands/add";
import edit from "../src/commands/edit";
import deleteCmd from "../src/commands/delete";
import list from "../src/commands/list";
import exportCmd from "../src/commands/export";
import { loadEnv } from "../src/loadEnv";
import { writeSecrets } from "../src/lib/secrets";
import { resolvePaths } from "../src/lib/paths";
import { makeSandbox, Sandbox } from "./sandbox";

const prompt = inquirer.prompt as unknown as jest.Mock;
const ENV = { _: [], e: "test" };

describe("add / edit / delete round-trips", () => {
  let sandbox: Sandbox;

  let log: jest.SpyInstance;

  beforeEach(async () => {
    sandbox = makeSandbox();
    prompt.mockReset();
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    await init(ENV);
  });

  afterEach(() => {
    log.mockRestore();
    sandbox.restore();
    delete process.env.API_KEY;
    delete process.env.DB_URL;
  });

  it("adds a key and round-trips it through decryption", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "secret-1" });
    await add(ENV);

    const secrets = await loadEnv("test");
    expect(secrets.API_KEY).toBe("secret-1");
  });

  it("refuses to add a duplicate key", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "one" });
    await add(ENV);

    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "two" });
    await expect(add(ENV)).rejects.toThrow(/already exists/);
  });

  it("leaves no temp files behind after a write", async () => {
    // `writeSecrets` (via add) stages a `.coolerenv-*.tmp` file and atomically
    // renames it over the encrypted file; nothing transient should remain.
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "secret" });
    await add(ENV);

    const leftovers = fs
      .readdirSync(path.join(sandbox.dir, "config"))
      .filter((f) => f.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("allows an empty-string value", async () => {
    prompt.mockResolvedValueOnce({ keyName: "EMPTY", keyValue: "" });
    await add(ENV);

    const secrets = await loadEnv("test");
    expect(secrets.EMPTY).toBe("");
  });

  it("adds non-interactively with -k/-v and never prompts", async () => {
    await add({ ...ENV, key: "API_KEY", value: "sk_live_1" });

    expect(prompt).not.toHaveBeenCalled();
    const secrets = await loadEnv("test");
    expect(secrets.API_KEY).toBe("sk_live_1");
  });

  it("non-interactively allows an empty value but rejects a bad key", async () => {
    await add({ ...ENV, key: "EMPTY", value: "" });
    await expect(add({ ...ENV, key: "BAD-KEY", value: "x" })).rejects.toThrow(
      /must start with a letter/,
    );

    const secrets = await loadEnv("test");
    expect(secrets.EMPTY).toBe("");
  });

  it("non-interactive add requires a key when only a value is given", async () => {
    await expect(add({ ...ENV, value: "x" })).rejects.toThrow(/requires a key/);
  });

  it("non-interactively refuses to overwrite an existing key", async () => {
    await add({ ...ENV, key: "API_KEY", value: "one" });
    await expect(add({ ...ENV, key: "API_KEY", value: "two" })).rejects.toThrow(
      /already exists/,
    );
  });

  it("keeps the current value when edit is submitted blank", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "keep-me" });
    await add(ENV);

    prompt
      .mockResolvedValueOnce({ keyToEdit: "API_KEY" })
      .mockResolvedValueOnce({ keyEditedValue: "" }); // a blank submission
    await edit(ENV);

    const secrets = await loadEnv("test");
    expect(secrets.API_KEY).toBe("keep-me"); // not blanked
  });

  it("reads the key file only once per mutating command", async () => {
    const readFile = jest.spyOn(fs.promises, "readFile");
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "v" });
    await add(ENV);

    const keyReads = readFile.mock.calls.filter((c) =>
      String(c[0]).endsWith(".key"),
    ).length;
    readFile.mockRestore();

    expect(keyReads).toBe(1);
  });

  it("edits an existing key's value", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "old" });
    await add(ENV);

    prompt
      .mockResolvedValueOnce({ keyToEdit: "API_KEY" })
      .mockResolvedValueOnce({ keyEditedValue: "new" });
    await edit(ENV);

    const secrets = await loadEnv("test");
    expect(secrets.API_KEY).toBe("new");
  });

  it("deletes selected keys and leaves the rest intact", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "a" });
    await add(ENV);
    prompt.mockResolvedValueOnce({ keyName: "DB_URL", keyValue: "b" });
    await add(ENV);

    prompt.mockResolvedValueOnce({ keysToDelete: ["API_KEY"] });
    await deleteCmd(ENV);

    const secrets = await loadEnv("test");
    expect(secrets.API_KEY).toBeUndefined();
    expect(secrets.DB_URL).toBe("b");
  });

  it("errors when editing before any keys exist", async () => {
    await expect(edit(ENV)).rejects.toThrow(/Nothing to edit/);
  });

  it("errors on add for an uninitialized environment", async () => {
    prompt.mockResolvedValueOnce({ keyName: "X", keyValue: "y" });
    await expect(add({ _: [], e: "nope" })).rejects.toThrow(
      /Encryption key not found/,
    );
  });
});

describe("secret value masking", () => {
  let sandbox: Sandbox;
  let log: jest.SpyInstance;

  // Find a prompt question by name across every recorded prompt() call.
  const question = (name: string): Record<string, unknown> | undefined => {
    for (const call of prompt.mock.calls) {
      const questions = call[0];
      if (Array.isArray(questions)) {
        const match = questions.find((q) => q && q.name === name);
        if (match) return match;
      }
    }
    return undefined;
  };

  beforeEach(async () => {
    sandbox = makeSandbox();
    prompt.mockReset();
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    await init(ENV);
  });

  afterEach(() => {
    log.mockRestore();
    sandbox.restore();
  });

  it("masks the value prompt on add by default (fully hidden, no mask)", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "s" });
    await add(ENV);

    const q = question("keyValue");
    expect(q?.type).toBe("password");
    // No `mask` -> the password prompt hides the value entirely, including its
    // length. A "*" mask would leak the length into scrollback.
    expect(q?.mask).toBeUndefined();
  });

  it("shows the value prompt on add with --show", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "s" });
    await add({ ...ENV, show: true });

    expect(question("keyValue")?.type).toBe("input");
  });

  it("masks the edit prompt and hides the current value by default", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "old" });
    await add(ENV);

    prompt
      .mockResolvedValueOnce({ keyToEdit: "API_KEY" })
      .mockResolvedValueOnce({ keyEditedValue: "new" });
    await edit(ENV);

    const q = question("keyEditedValue");
    expect(q?.type).toBe("password");
    expect(q?.default).toBeUndefined();
  });

  it("prefills the current value on edit with --show", async () => {
    prompt.mockResolvedValueOnce({ keyName: "API_KEY", keyValue: "old" });
    await add(ENV);

    prompt
      .mockResolvedValueOnce({ keyToEdit: "API_KEY" })
      .mockResolvedValueOnce({ keyEditedValue: "new" });
    await edit({ ...ENV, show: true });

    const q = question("keyEditedValue");
    expect(q?.type).toBe("input");
    expect(q?.default).toBe("old");
  });
});

describe("list", () => {
  let sandbox: Sandbox;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(async () => {
    sandbox = makeSandbox();
    prompt.mockReset();
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    error = jest.spyOn(console, "error").mockImplementation(() => {});
    await init(ENV);
  });

  afterEach(() => {
    log.mockRestore();
    error.mockRestore();
    sandbox.restore();
  });

  it("prints key names sorted, one per line", async () => {
    await writeSecrets(resolvePaths("test"), { B_KEY: "2", A_KEY: "1" });

    log.mockClear(); // drop init's output
    await list(ENV);

    expect(log.mock.calls.map((c) => c[0])).toEqual(["A_KEY", "B_KEY"]);
  });

  it("prints KEY=value only with --values", async () => {
    await writeSecrets(resolvePaths("test"), { A_KEY: "secret" });

    await list(ENV);
    expect(log).toHaveBeenLastCalledWith("A_KEY");

    log.mockClear();
    await list({ ...ENV, values: true });
    expect(log).toHaveBeenLastCalledWith("A_KEY=secret");
  });

  it("quotes --values output so a newline can't spoof a key", async () => {
    await writeSecrets(resolvePaths("test"), {
      NL: "line1\nFAKE=injected",
      EMPTY: "",
    });

    log.mockClear();
    await list({ ...ENV, values: true });
    const lines = log.mock.calls.map((c) => c[0]);

    // Every key prints on exactly one line; the newline is escaped, not raw.
    expect(lines).toContain('NL="line1\\nFAKE=injected"');
    expect(lines).toContain('EMPTY=""');
    expect(lines.some((l) => l.startsWith("FAKE="))).toBe(false);
  });

  it("reports an empty env on stderr, leaving stdout clean", async () => {
    log.mockClear();
    await list(ENV);

    expect(log).not.toHaveBeenCalled(); // nothing on stdout
    expect(error).toHaveBeenCalledWith(expect.stringContaining("No keys set."));
  });

  it("errors for an uninitialized environment", async () => {
    await expect(list({ _: [], e: "nope" })).rejects.toThrow(
      /Encryption key not found/,
    );
  });
});

describe("export", () => {
  let sandbox: Sandbox;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  // A spread of values that stress every quoting tier and every injection
  // vector at once. NEWLINE embeds a fake `KEY=` line; INJECT and INTERP carry
  // command substitutions and interpolations that must never fire.
  const SECRETS = {
    BARE: "sk_live_ABC-123",
    URL: "postgres://user:pass@host:5432/db",
    SPACE: "has space",
    WS: "  pad  ",
    HASH: "a#b=c",
    COMMENT: "# not really a comment",
    INTERP: "$HOME and `whoami`",
    QUOTE: 'it\'s a "trap"',
    INJECT: "it's $(touch pwned) and `touch pwned2`",
    LONE: "'",
    EXPORTLINE: "export EVIL=1",
    NEWLINE: "line1\nK99=evil\nline3",
    TAB: "a\tb",
    BACKSLASH: "a\\b\\c",
    EMPTY: "",
    UNICODE: "café — π",
    PEM: "-----BEGIN KEY-----\nabc+def/ghi=\n-----END KEY-----",
  };
  // Values that contain a single quote and so land in the lossy double-quoted
  // dotenv tier; they can't decode exactly through the dotenv parser.
  const LOSSY = ["QUOTE", "INJECT", "LONE"];

  // Shells to round-trip the --shell output through (only those installed).
  const SHELLS = ["sh", "bash", "zsh"].filter((sh) => {
    try {
      execFileSync(sh, ["-c", "true"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });

  const stdout = (): string =>
    log.mock.calls.map((c) => String(c[0])).join("\n");

  beforeEach(async () => {
    sandbox = makeSandbox();
    prompt.mockReset();
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    error = jest.spyOn(console, "error").mockImplementation(() => {});
    await init(ENV);
  });

  afterEach(() => {
    log.mockRestore();
    error.mockRestore();
    sandbox.restore();
  });

  it("round-trips through the dotenv parser without swallowing or spoofing keys", async () => {
    await writeSecrets(resolvePaths("test"), SECRETS);

    log.mockClear();
    await exportCmd(ENV);

    const parsed = parseEnv(stdout()) as Record<string, string>;

    // Exactly the input keys come back — no key swallowed, and the `K99=evil`
    // hidden in NEWLINE (or `EVIL` in EXPORTLINE) did not spoof a new key.
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(SECRETS).sort());

    for (const [key, value] of Object.entries(SECRETS)) {
      if (LOSSY.includes(key)) continue; // lossy tier: checked separately below
      expect(parsed[key]).toBe(value);
    }

    // Defense in depth: in the lossy double-quoted tier the `$` and backtick
    // are backslash-escaped, so an interpolating loader can't expand or run
    // them. Every lossy key is also named in a stderr warning.
    const injectLine = stdout()
      .split("\n")
      .find((l) => l.startsWith("INJECT="));
    expect(injectLine).toContain("\\$(");
    expect(injectLine).toContain("\\`");
    for (const key of LOSSY) {
      expect(error).toHaveBeenCalledWith(expect.stringContaining(key));
    }
  });

  it.each(SHELLS)(
    "round-trips every value exactly through %s with --shell (no injection)",
    async (sh) => {
      await writeSecrets(resolvePaths("test"), SECRETS);

      log.mockClear();
      await exportCmd({ ...ENV, shell: true });
      const script = stdout();

      // Source the emitted script, then print each value back with a NUL
      // separator so newlines in values don't corrupt the readback.
      const keys = Object.keys(SECRETS);
      const readback = keys.map((k) => `printf '%s\\0' "$${k}"`).join("\n");
      const out = execFileSync(sh, ["-c", `${script}\n${readback}`]);
      const values = out.toString("utf8").split("\0").slice(0, keys.length);

      keys.forEach((key, i) => {
        expect(values[i]).toBe(SECRETS[key as keyof typeof SECRETS]);
      });

      // The command substitutions in INJECT/INTERP stayed inert — no file
      // was created in the sandbox cwd the shell inherited.
      expect(fs.existsSync("pwned")).toBe(false);
      expect(fs.existsSync("pwned2")).toBe(false);
    },
  );

  it("warns that a carriage return won't round-trip in the dotenv dialect", async () => {
    await writeSecrets(resolvePaths("test"), { CR: "a\r\nb" });

    log.mockClear();
    await exportCmd(ENV);

    // The value is single-quoted (not the double-quoted tier) yet still flagged
    // lossy, because dotenv/parseEnv mangle the CR.
    expect(stdout()).toBe("CR='a\r\nb'");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("CR"));
  });

  it("prints keys sorted, one KEY=value per line", async () => {
    await writeSecrets(resolvePaths("test"), { B: "2", A: "1" });

    log.mockClear();
    await exportCmd(ENV);

    expect(stdout()).toBe("A=1\nB=2");
  });

  it("emits `export KEY=…` lines with --shell", async () => {
    await writeSecrets(resolvePaths("test"), { A: "1", B: "has space" });

    log.mockClear();
    await exportCmd({ ...ENV, shell: true });

    expect(stdout()).toBe("export A=1\nexport B='has space'");
  });

  it("reports an empty env on stderr, leaving stdout clean", async () => {
    log.mockClear();
    await exportCmd(ENV);

    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("No keys set."));
  });

  it("aborts before any output when a key is invalid for --shell", async () => {
    // `FOO-BAR` is a legal dotenv key but not a shell identifier.
    await writeSecrets(resolvePaths("test"), { "FOO-BAR": "x", OK: "y" });

    log.mockClear();
    await expect(exportCmd({ ...ENV, shell: true })).rejects.toThrow(/FOO-BAR/);
    expect(log).not.toHaveBeenCalled(); // fail-fast: nothing written
  });

  it("errors for an uninitialized environment", async () => {
    await expect(exportCmd({ _: [], e: "nope" })).rejects.toThrow(
      /Encryption key not found/,
    );
  });
});
