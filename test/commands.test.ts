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

  beforeEach(async () => {
    sandbox = makeSandbox();
    prompt.mockReset();
    await init(ENV);
  });

  afterEach(() => {
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
      /Encryption key not found/
    );
  });
});
