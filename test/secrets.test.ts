import { encryptSecrets, decryptSecrets } from "../src/lib/secrets";

const KEY = "a".repeat(64);

describe("encryptSecrets / decryptSecrets", () => {
  it("round-trips a secrets object", () => {
    const secrets = { API_KEY: "abc123", DB_URL: "postgres://x" };
    const blob = encryptSecrets(secrets, KEY);

    expect(decryptSecrets(blob, KEY)).toEqual(secrets);
  });

  it("produces different ciphertext each time (random salt + IV)", () => {
    const secrets = { A: "1" };

    expect(encryptSecrets(secrets, KEY).equals(encryptSecrets(secrets, KEY))).toBe(
      false
    );
  });

  it("rejects the wrong key", () => {
    const blob = encryptSecrets({ A: "1" }, KEY);

    expect(() => decryptSecrets(blob, "b".repeat(64))).toThrow(/wrong|tampered/);
  });

  it("detects tampering via the auth tag", () => {
    const blob = encryptSecrets({ A: "1" }, KEY);
    blob[blob.length - 1] ^= 0xff; // flip a ciphertext byte

    expect(() => decryptSecrets(blob, KEY)).toThrow(/wrong|tampered/);
  });

  it("rejects a truncated blob", () => {
    expect(() => decryptSecrets(Buffer.alloc(8), KEY)).toThrow(
      /truncated or corrupt/
    );
  });

  it("strips prototype-polluting keys", () => {
    // Encrypt a raw payload that contains a dangerous key.
    const blob = encryptSecrets(
      JSON.parse('{"__proto__":"x","SAFE":"ok"}'),
      KEY
    );
    const result = decryptSecrets(blob, KEY);

    expect(result.SAFE).toBe("ok");
    expect(Object.keys(result)).not.toContain("__proto__");
  });
});
