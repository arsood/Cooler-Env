module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", {}],
  },
  // Measure coverage over the real source only (the CLI entry point is a thin
  // shebang + banner wrapper exercised by the compiled smoke test, not here).
  collectCoverageFrom: ["src/**/*.ts", "!src/cli.ts"],
  // A regression floor, set a little below current coverage (~95% statements,
  // ~90% branches) so a meaningful drop fails CI without being brittle. Raise
  // it as coverage improves; never lower it to make a red build pass.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
  },
};
