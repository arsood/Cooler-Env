# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (breaking)

- **Minimum supported Node is now 20** (`engines.node: ">=20"`). Node 18 reached
  end-of-life in April 2025; dropping it keeps the package on supported runtimes
  and lets `@types/node` track a current line. (The CLI itself still runs on the
  full Node 20 range — see the `inquirer` note below.)
- Key names are validated as environment-variable identifiers on `add`: they
  must start with a letter or underscore and contain only ASCII letters, digits,
  and underscores (e.g. `API_KEY`). Names that earlier versions accepted — such
  as `API-KEY`, `my.key`, a name with spaces, or a non-ASCII name — are now
  rejected at the prompt. Existing stored keys are unaffected: only newly added
  keys are checked, and `edit`/`delete`/`loadEnv` still handle any name already
  in the file.

### Changed

- `add` now accepts an **empty-string value** (a legitimate value for some
  variables; previously the prompt rejected `""`). On `edit`, a **blank entry
  keeps the current value** — in both masked and `--show` modes — so a stray
  Enter can never silently erase a secret.
- Aborting a prompt with Ctrl+C now exits with code **130** (the SIGINT
  convention) instead of 1, so scripts can tell an interrupt from an error.

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
- `--show` flag on `add` and `edit` to type secret values in the clear (and,
  on `edit`, to pre-fill and edit the current value in place).
- `list` command: prints an environment's key names (sorted, one per line);
  `--values` also prints the values as `KEY=value`.
- `--help` / `-h` (usage, commands, and options) and `--version` / `-v`.
- Unrecognized options are now ignored with a warning on stderr instead of
  being silently accepted.

### Security

- Secret values are **hidden at the prompt by default** on `add` and `edit`:
  the value is not echoed to the terminal, and (unlike a `*`-masked prompt) its
  length is not shown either, so nothing about the secret lands in scrollback.
  `edit` also no longer pre-fills the current value in the clear. Use `--show`
  to opt back into visible input.
- Re-initializing an existing environment now resets the key file to `0600`.
  Previously `writeFileSync`'s `mode` was ignored when overwriting an existing
  file, so a key file with looser permissions kept them across a re-`init`.

### On-disk format

- The `.yml.enc` blob now carries a 5-byte versioned header
  (`[magic "CENV"(4)][version(1)]`) ahead of the existing
  `[salt(16)][iv(12)][authTag(16)][ciphertext]` body, so the KDF/cipher
  parameters can evolve in future versions. The header is bound into the GCM
  auth tag (as additional authenticated data), so the version byte cannot be
  altered without decryption failing. Reads are backward compatible: headerless
  blobs written by v3 are still decrypted (treated as version 0). Files written
  by v4 are not readable by v3.

### Internal

- Prettier is now enforced: explicit config, `yarn format` / `yarn format:check`
  scripts, a CI check, and a one-time mechanical reformat.
- TypeScript now targets ES2022 (native on every supported Node), so the build
  no longer downlevels `async`/`await` or classes.
- CI lints and checks formatting once on Node 22 and builds/tests on Node 20,
  22, and 24.
- Dev dependencies: ESLint 10, `@eslint/js` 10, `typescript-eslint` 8.69. The
  `yarn npm audit` deprecation warning for ESLint 9 is gone.
- Dropped the `figlet` dependency (~7 MB) in favour of a small inlined banner,
  shrinking the install. The banner is unchanged and still TTY-only.
- `writeSecrets` no longer uses synchronous `fs`, so the whole crypto path is
  async; and `add`/`edit`/`delete` read the key file once per run (via
  `readSecretsWithKey`) instead of twice.
- The `DANGEROUS_KEYS` prototype-pollution list now lives in one module
  (`src/lib/constants.ts`), shared by the key-name validator and the payload
  sanitizer instead of being duplicated.
- `inquirer` upgraded to 12, and `@types/node` moved to 20 to match `engines`.
  inquirer 12 ships a dual CommonJS/ESM build, so the CLI keeps working from
  this package's CommonJS output across the whole Node 20 range. (inquirer 13+
  is ESM-only, which would break `require("inquirer")` on Node 20.0–20.18 /
  22.0–22.11, where `require(ESM)` is still flagged — so we stay on 12.)
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
