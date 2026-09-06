import {
  formatDisplayValue,
  formatDotenvValue,
  formatShellValue,
} from "../src/lib/dotenv";

// One PEM-ish multiline blob reused across tiers.
const PEM = "-----BEGIN KEY-----\nabc+def/ghi=\n-----END KEY-----";

describe("formatDisplayValue (list --values)", () => {
  it.each([
    "abc123",
    "sk_live_ABC-123",
    "postgres://user:pass@host:5432/db",
    "a.b/c:d@e%f+g",
  ])("prints a safe value %j bare", (value) => {
    expect(formatDisplayValue(value)).toBe(value);
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
    expect(formatDisplayValue(value)).toBe(expected);
  });

  it("round-trips a quoted value through JSON.parse", () => {
    const value = 'tricky\n"=" value';
    expect(JSON.parse(formatDisplayValue(value))).toBe(value);
  });
});

describe("formatDotenvValue", () => {
  it.each([
    ["abc123", "abc123"],
    ["a.b/c:d@e%f+g", "a.b/c:d@e%f+g"],
  ])("bare for a safe value %j", (value, text) => {
    expect(formatDotenvValue(value)).toEqual({ text, lossy: false });
  });

  it.each([
    ["", "''"],
    ["has space", "'has space'"],
    ["a=b", "'a=b'"],
    ["with#hash", "'with#hash'"],
    ["$INTERP", "'$INTERP'"],
    ["back`tick", "'back`tick'"],
    ["a\\b", "'a\\b'"],
    ['a"b', "'a\"b'"],
    ["line1\nline2", "'line1\nline2'"],
    [PEM, `'${PEM}'`],
  ])("single-quotes an unsafe value %j losslessly", (value, text) => {
    expect(formatDotenvValue(value)).toEqual({ text, lossy: false });
  });

  it.each([
    ["it's", `"it's"`, true],
    ["a'b\\c", `"a'b\\\\c"`, true],
    ["a'b\"c", `"a'b\\"c"`, true],
    // `$` and backtick are backslash-escaped in this tier so an interpolating
    // loader can't expand or execute them.
    ["it's $(x)", '"it\'s \\$(x)"', true],
    ["a'b`c", '"a\'b\\`c"', true],
  ])(
    "double-quotes (lossy) a value %j that contains a single quote",
    (value, text, lossy) => {
      expect(formatDotenvValue(value)).toEqual({ text, lossy });
    },
  );

  it("flags a carriage return lossy even in the single-quoted tier", () => {
    // Single-quoted (no `'` in the value) but still lossy: dotenv/parseEnv
    // mangle a CR even inside quotes.
    expect(formatDotenvValue("a\r\nb")).toEqual({
      text: "'a\r\nb'",
      lossy: true,
    });
  });
});

describe("formatShellValue", () => {
  it.each([
    ["abc123", "abc123"],
    ["a.b/c:d@e%f+g", "a.b/c:d@e%f+g"],
  ])("bare for a safe value %j", (value, expected) => {
    expect(formatShellValue(value)).toBe(expected);
  });

  it.each([
    ["has space", "'has space'"],
    ["$INTERP", "'$INTERP'"],
    ["back`tick", "'back`tick'"],
    ["a\\b", "'a\\b'"],
    ['a"b', "'a\"b'"],
    ["line1\nline2", "'line1\nline2'"],
    ["it's", "'it'\\''s'"],
    ["a'b'c", "'a'\\''b'\\''c'"],
    [PEM, `'${PEM}'`],
  ])("single-quotes an unsafe value %j", (value, expected) => {
    expect(formatShellValue(value)).toBe(expected);
  });
});
