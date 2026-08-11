# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
