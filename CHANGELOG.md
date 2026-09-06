# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (breaking)

- **Minimum supported Node is now 20** (`engines.node: ">=20"`). Node 18 reached
  end-of-life in April 2025; dropping it lets the package track current
  `inquirer` and `@types/node`. This is the only reason v4 is a major bump —
  there are no API or on-disk format changes from v3.

### Fixed

- `-p` with an absolute path wrote files under `<cwd>/<absolute path>` while
  gitignoring the real absolute path. Paths are now resolved with
  `path.resolve`, so absolute and relative config directories both work.
- The `.gitignore` entry written by `init` is now derived from the key's real
  path relative to the current directory in POSIX form, anchored with a leading
  `/`, and with gitignore metacharacters (`#`, `!`, `[`, `*`, `?`) escaped. So
  `-p ./config/` yields `/config/dev.key` instead of the unmatchable
  `./config//dev.key`, `-p '#secrets'` no longer writes a comment line, and
  `-p .` no longer ignores every `dev.key` at any depth. A key outside the
  current directory, or one whose path contains a backslash, produces a warning
  on stderr instead of a broken entry, and a `.gitignore` that cannot be
  written is reported as a warning rather than aborting after the key exists.
  Entries written by earlier versions are still recognized and not duplicated.
- Environment names are validated in both the CLI and `loadEnv`: they must be
  non-blank, at most 200 characters, and cannot be `.`, `..`, or contain path
  separators, so `-e ../escape` can no longer write files outside the config
  directory. Other characters (unicode, `@`, spaces) remain allowed, so
  existing environments keep working. Repeating `-e` or `-p` is rejected
  instead of joining the values into `a,b`.
- `-e` and `-p` are parsed as strings, so `-p 123` is no longer silently
  ignored. A bare `-p` (or `-p` followed by another flag) is an error instead
  of silently falling back to `config/`, and `--no-e` / `-e "  "` get the
  usual "-e option" message.
- Command lookup no longer resolves `Object.prototype` members: running
  `cooler-env constructor` now fails with the usual "valid command" error
  instead of exiting 0 silently.
- CLI errors are printed to stderr, and the banner is only shown on a TTY so
  piped output stays clean.
- A decrypted payload that is valid JSON but not an object (`null`, an array)
  now throws a `CoolerEnvError` instead of a raw `TypeError`.
- A freshly created `.gitignore` no longer starts with a blank line.

### Added

- `CoolerEnvError` is exported from the package entry point so callers can
  `instanceof` it, as the README already documented.

### Internal

- Prettier is now enforced: explicit config, `yarn format` / `yarn format:check`
  scripts, a CI check, and a one-time mechanical reformat.
- TypeScript now targets ES2022 (native on every supported Node), so the build
  no longer downlevels `async`/`await` or classes.
- CI lints and checks formatting once on Node 22 and builds/tests on Node 20,
  22, and 24.
- Dev dependencies: ESLint 10, `@eslint/js` 10, `typescript-eslint` 8.69. The
  `yarn npm audit` deprecation warning for ESLint 9 is gone.
- `inquirer` upgraded to 14 (unblocked by the Node 20 floor; 12+ requires
  Node 20.17), and `@types/node` moved to 20 to match `engines`.
- `prepublishOnly` now runs lint, format check, and tests before building.

## [3.0.0] - 2026-08-10

The v3 line is a security and API overhaul. **It is a hard break from v2:**
encrypted files written by v2 cannot be read by v3, and the `loadEnv` signature
has changed.

### Changed (breaking)

- **Encryption is now authenticated `aes-256-gcm`** using Node's built-in
  `crypto`, replacing the previous `cryptify` / `aes-256-cbc` scheme. The
  on-disk format is a single binary blob — `[salt(16)][iv(12)][authTag(16)][ciphertext]`
  — with a fresh random salt and IV per write and the key derived via `scrypt`.
  **v2 `.yml.enc` files are not readable by v3;** decrypt with v2, upgrade, then
  re-`init` and re-add your secrets.
- **`loadEnv` no longer mutates `process.env` by default.** It now decrypts and
  returns the `Secrets` object, leaving global state untouched. Pass
  `{ inject: true }` for the previous behavior.
- **`loadEnv`'s positional `configPath` argument is replaced by an options
  object** (`LoadEnvOptions`): `{ configPath, inject, override }`.
- `loadEnv` now rejects with `CoolerEnvError` (not a plain `Error`) for expected
  failures, consistent with the rest of the library.

### Added

- `inject` option on `loadEnv` to opt into writing secrets to `process.env`.
- `override` option (default `false`) so a value already set in the environment
  (e.g. by the shell or CI) wins over the encrypted file when injecting, matching
  dotenv's precedence.
- Exported `LoadEnvOptions` type alongside `loadEnv` and `Secrets`.
- Continuous integration (GitHub Actions) running lint, build, and tests across
  Node 18, 20, and 22.
- Test suite (Jest) covering the crypto round-trip, tamper/wrong-key detection,
  the CLI commands, and `loadEnv`'s injection and override behavior.

### Security

- Authenticated encryption (GCM auth tag) means a wrong key or any tampering
  fails loudly instead of returning corrupt output.
- Writes produce ciphertext in memory and **atomically rename** a temp file over
  the encrypted file, so plaintext never touches disk and an interrupted write
  cannot leave a half-written file.
- Decrypted payloads are sanitized to drop prototype-polluting keys
  (`__proto__`, `constructor`, `prototype`) before reaching your object or
  `process.env`.
- Dependency audit: eliminated all known production vulnerabilities and trimmed
  the dev dependency tree.

### Internal

- The crypto path is now genuinely asynchronous: `scrypt` runs off-thread via
  `promisify` and file reads use `fs.promises`.
- `ENOENT` is translated into friendly "key/encrypted file not found" errors
  inside `readSecrets`, removing redundant `existsSync` checks and their
  time-of-check/time-of-use gap.

### Documentation

- Rewrote the README: status badges, table of contents, "How it works" overview,
  full CLI reference, expanded `loadEnv` API docs (options table, TypeScript,
  error handling), a security-model section, and a v2 upgrade guide.

## [2.1.0]

- Last release of the v2 line (`cryptify` / `aes-256-cbc` encryption). See the
  git history for details.

[3.0.0]: https://github.com/arsood/Cooler-Env/compare/v2.1.0...v3.0.0
[2.1.0]: https://github.com/arsood/Cooler-Env/releases/tag/v2.1.0
