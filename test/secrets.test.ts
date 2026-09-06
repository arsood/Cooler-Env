import fs from "fs";
import os from "os";
import path from "path";

import {
  encryptSecrets,
  decryptSecrets,
  writeSecrets,
} from "../src/lib/secrets";

const KEY = "a".repeat(64);

describe("encryptSecrets / decryptSecrets", () => {
  it("round-trips a secrets object", async () => {
    const secrets = { API_KEY: "abc123", DB_URL: "postgres://x" };
    const blob = await encryptSecrets(secrets, KEY);

    expect(await decryptSecrets(blob, KEY)).toEqual(secrets);
  });

  it("produces different ciphertext each time (random salt + IV)", async () => {
    const secrets = { A: "1" };
    const a = await encryptSecrets(secrets, KEY);
    const b = await encryptSecrets(secrets, KEY);

    expect(a.equals(b)).toBe(false);
  });

  it("rejects the wrong key", async () => {
    const blob = await encryptSecrets({ A: "1" }, KEY);

    await expect(decryptSecrets(blob, "b".repeat(64))).rejects.toThrow(
      /wrong|tampered/,
    );
  });

  it("detects tampering via the auth tag", async () => {
    const blob = await encryptSecrets({ A: "1" }, KEY);
    blob[blob.length - 1] ^= 0xff; // flip a ciphertext byte

    await expect(decryptSecrets(blob, KEY)).rejects.toThrow(/wrong|tampered/);
  });

  it("rejects a truncated blob", async () => {
    await expect(decryptSecrets(Buffer.alloc(8), KEY)).rejects.toThrow(
      /truncated or corrupt/,
    );
  });

  it.each(["null", "[1,2]", '"text"'])(
    "rejects a decrypted payload that is not an object (%s)",
    async (json) => {
      const blob = await encryptSecrets(JSON.parse(json), KEY);

      await expect(decryptSecrets(blob, KEY)).rejects.toThrow(
        /not a key\/value object/,
      );
    },
  );

  it("strips prototype-polluting keys", async () => {
    // Encrypt a raw payload that contains a dangerous key.
    const blob = await encryptSecrets(
      JSON.parse('{"__proto__":"x","SAFE":"ok"}'),
      KEY,
    );
    const result = await decryptSecrets(blob, KEY);

    expect(result.SAFE).toBe("ok");
    expect(Object.keys(result)).not.toContain("__proto__");
  });

  it("prefixes new blobs with the CENV magic and version 1", async () => {
    const blob = await encryptSecrets({ A: "1" }, KEY);

    expect(blob.subarray(0, 4).toString("ascii")).toBe("CENV");
    expect(blob[4]).toBe(1);
  });

  it("still reads a real v3 (headerless) blob", async () => {
    // A fixed blob written by v3 (pre-header) from the master branch: password
    // "deadbeef", plaintext {"A":"1","B":"two"}. Using a real fixture — not a
    // v4 blob with the header sliced off — actually pins v3 compatibility.
    const v3 =
      "644ffa990b9d71981021acf2b899dc8673d2f2e0a554a3b51ddec96de4eae6a4aeea0c7a42b345d4d5e036ad5bf3d7a32ec34188d64990cacc1c33bc879446";

    expect(await decryptSecrets(Buffer.from(v3, "hex"), "deadbeef")).toEqual({
      A: "1",
      B: "two",
    });
  });

  it("authenticates the header: a stripped header fails to decrypt", async () => {
    // Removing the 5-byte header turns a v4 blob into a headerless body, but
    // the header was bound in as AAD, so decryption of the salt/iv/tag body
    // must fail rather than silently succeed.
    const blob = await encryptSecrets({ A: "1" }, KEY);

    await expect(decryptSecrets(blob.subarray(5), KEY)).rejects.toThrow(
      /wrong|tampered/,
    );
  });

  it("authenticates the header: a flipped magic byte fails to decrypt", async () => {
    const blob = await encryptSecrets({ A: "1" }, KEY);
    blob[0] ^= 0xff; // corrupt the magic -> read as a headerless body

    await expect(decryptSecrets(blob, KEY)).rejects.toThrow(/wrong|tampered/);
  });

  it("rejects an unsupported format version", async () => {
    const blob = await encryptSecrets({ A: "1" }, KEY);
    blob[4] = 2; // bump the version byte to an unknown value

    await expect(decryptSecrets(blob, KEY)).rejects.toThrow(
      /Unsupported encrypted file format version 2/,
    );
  });

  it("reports a bare-magic blob as truncated, not a bogus version", async () => {
    // Just the 4 magic bytes: the version read must not run past the buffer.
    await expect(
      decryptSecrets(Buffer.from("CENV", "ascii"), KEY),
    ).rejects.toThrow(/truncated or corrupt/);
  });
});

describe("writeSecrets", () => {
  it("removes the staging temp file when the write fails mid-way", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coolerenv-ws-"));
    const paths = {
      configDir: dir,
      keyFile: path.join(dir, "t.key"),
      encryptedFile: path.join(dir, "t.yml.enc"),
    };

    // Fail the atomic rename after the staging file has been written, so the
    // `finally` cleanup is the only thing that can remove it.
    const rename = jest
      .spyOn(fs.promises, "rename")
      .mockRejectedValueOnce(new Error("rename boom"));

    try {
      await expect(writeSecrets(paths, { A: "1" }, KEY)).rejects.toThrow(
        "rename boom",
      );

      const leftovers = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith(".coolerenv-"));
      expect(leftovers).toEqual([]);
    } finally {
      rename.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
