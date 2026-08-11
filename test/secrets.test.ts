import { encryptSecrets, decryptSecrets } from "../src/lib/secrets";

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
      /wrong|tampered/
    );
  });

  it("detects tampering via the auth tag", async () => {
    const blob = await encryptSecrets({ A: "1" }, KEY);
    blob[blob.length - 1] ^= 0xff; // flip a ciphertext byte

    await expect(decryptSecrets(blob, KEY)).rejects.toThrow(/wrong|tampered/);
  });

  it("rejects a truncated blob", async () => {
    await expect(decryptSecrets(Buffer.alloc(8), KEY)).rejects.toThrow(
      /truncated or corrupt/
    );
  });

  it("strips prototype-polluting keys", async () => {
    // Encrypt a raw payload that contains a dangerous key.
    const blob = await encryptSecrets(
      JSON.parse('{"__proto__":"x","SAFE":"ok"}'),
      KEY
    );
    const result = await decryptSecrets(blob, KEY);

    expect(result.SAFE).toBe("ok");
    expect(Object.keys(result)).not.toContain("__proto__");
  });
});
