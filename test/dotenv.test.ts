import { formatEnvValue } from "../src/lib/dotenv";

describe("formatEnvValue", () => {
  it.each([
    "abc123",
    "sk_live_ABC-123",
    "postgres://user:pass@host:5432/db",
    "a.b/c:d@e%f+g",
  ])("prints a safe value %j bare", (value) => {
    expect(formatEnvValue(value)).toBe(value);
  });

  it.each([
    ["", '""'],
    ["has space", '"has space"'],
    ["a=b", '"a=b"'],
    ["with#hash", '"with#hash"'],
    ["$INTERP", '"$INTERP"'],
    ['quote"inside', '"quote\\"inside"'],
    ["line1\nline2", '"line1\\nline2"'],
  ])("JSON-quotes an unsafe value %j", (value, expected) => {
    expect(formatEnvValue(value)).toBe(expected);
  });

  it("round-trips a quoted value through JSON.parse", () => {
    const value = 'tricky\n"=" value';
    expect(JSON.parse(formatEnvValue(value))).toBe(value);
  });
});
