jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

import inquirer from "inquirer";
import init from "../src/commands/init";
import add from "../src/commands/add";
import edit from "../src/commands/edit";
import deleteCmd from "../src/commands/delete";
import { loadEnv } from "../src/loadEnv";
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

  it("allows an empty-string value", async () => {
    prompt.mockResolvedValueOnce({ keyName: "EMPTY", keyValue: "" });
    await add(ENV);

    const secrets = await loadEnv("test");
    expect(secrets.EMPTY).toBe("");
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
