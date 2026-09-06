import { validateKeyName, validateValue } from "../src/lib/guards";

describe("validateKeyName", () => {
  it.each(["API_KEY", "_private", "PORT", "a", "X1", "DB_URL_2"])(
    "accepts the valid env-var name %j",
    (name) => {
      expect(validateKeyName(name)).toBe(true);
    },
  );

  it("trims surrounding whitespace before validating", () => {
    expect(validateKeyName("  API_KEY  ")).toBe(true);
  });

  it("rejects an empty or blank name", () => {
    expect(validateKeyName("")).toMatch(/non-empty/);
    expect(validateKeyName("   ")).toMatch(/non-empty/);
  });

  it.each(["__proto__", "constructor", "prototype"])(
    "rejects the reserved name %j",
    (name) => {
      expect(validateKeyName(name)).toMatch(/reserved/);
    },
  );

  it.each(["1KEY", "API-KEY", "API KEY", "API.KEY", "café", "a$b", "key!"])(
    "rejects the invalid env-var name %j",
    (name) => {
      expect(validateKeyName(name)).toMatch(/must start with a letter/);
    },
  );
});

describe("validateValue", () => {
  it("accepts a non-empty value", () => {
    expect(validateValue("x")).toBe(true);
  });

  it("rejects an empty value", () => {
    expect(validateValue("")).toMatch(/enter a value/);
  });
});
