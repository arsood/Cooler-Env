import path from "path";

import {
  resolvePaths,
  requireEnv,
  configPathOf,
  validateEnvName,
} from "../src/lib/paths";
import { makeSandbox, Sandbox } from "./sandbox";

describe("validateEnvName", () => {
  it.each(["development", "prod-1", "my_env", "v2.0"])("accepts %s", (env) => {
    expect(validateEnvName(env)).toBe(env);
  });

  it.each(["", " ", "../escape", "a/b", "a,b", ".", "..", ".hidden"])(
    "rejects %j",
    (env) => {
      expect(() => validateEnvName(env)).toThrow(/environment name/);
    }
  );

  it("rejects non-strings", () => {
    expect(() => validateEnvName(undefined)).toThrow(/environment name/);
    expect(() => validateEnvName(42)).toThrow(/environment name/);
  });
});

describe("requireEnv / configPathOf", () => {
  it("rejects a missing or empty -e", () => {
    expect(() => requireEnv({ _: [] })).toThrow(/-e option/);
    expect(() => requireEnv({ _: [], e: "" })).toThrow(/-e option/);
  });

  it("rejects a repeated -e instead of joining the values", () => {
    expect(() => requireEnv({ _: [], e: ["a", "b"] })).toThrow(/only once/);
  });

  it("returns undefined for a missing or empty -p and rejects a repeated one", () => {
    expect(configPathOf({ _: [] })).toBeUndefined();
    expect(configPathOf({ _: [], p: "" })).toBeUndefined();
    expect(configPathOf({ _: [], p: "secrets" })).toBe("secrets");
    expect(() => configPathOf({ _: [], p: ["a", "b"] })).toThrow(/only once/);
  });
});

describe("resolvePaths", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => sandbox.restore());

  it("defaults to <cwd>/config", () => {
    const paths = resolvePaths("test");
    expect(paths.configDir).toBe(path.join(sandbox.dir, "config"));
    expect(paths.keyFile).toBe(path.join(sandbox.dir, "config", "test.key"));
    expect(paths.encryptedFile).toBe(
      path.join(sandbox.dir, "config", "test.yml.enc")
    );
  });

  it("normalizes a relative config path", () => {
    expect(resolvePaths("test", "./secrets/").configDir).toBe(
      path.join(sandbox.dir, "secrets")
    );
  });

  it("uses an absolute config path as-is", () => {
    const abs = path.join(sandbox.dir, "elsewhere");
    expect(resolvePaths("test", abs).configDir).toBe(abs);
  });
});
