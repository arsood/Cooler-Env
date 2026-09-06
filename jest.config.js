module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", {}],
  },
  // Measure coverage over the real source only (the CLI entry point is a thin
  // shebang + banner wrapper exercised by the compiled smoke test, not here).
  collectCoverageFrom: ["src/**/*.ts", "!src/cli.ts"],
  // A regression floor, set below current coverage (~94% statements, ~90%
  // branches, ~94% functions) so a meaningful drop fails CI without being
  // brittle. `functions` gets extra slack: it's a coarse count (48 functions),
  // so one or two small untested helpers swing it several points. Raise these
  // as coverage improves; never lower one to make a red build pass.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 85,
      lines: 90,
    },
  },
};
