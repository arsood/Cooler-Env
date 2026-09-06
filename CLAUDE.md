# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Build: `yarn build` (runs `tsc`, emitting to `dist/`). The package is published from `dist/`, so build before testing CLI/module behavior against compiled output.
- Test: `yarn test` (Jest)
- Lint: `yarn lint` (ESLint flat config in `eslint.config.mjs`; `eslint-config-prettier` disables formatting rules so ESLint and Prettier do not fight).
- Format: `yarn format` (Prettier, default config) and `yarn format:check`; CI fails on unformatted files, so run `yarn format` before committing.
- Run a single test: `yarn test test/init.test.ts` or `yarn test -t "Should create a key file"`
- Package manager is Yarn 4 (Berry, `node-modules` linker). Use `yarn`, not `npm`, for installs.
- Node: `.nvmrc` pins `lts/*`.

## Architecture

Cooler-Env is both a CLI and an importable module for managing encrypted environment variables (inspired by Rails credentials). Everything hinges on a per-environment trio of files inside a config directory (default `config/`, overridable with `-p` on the CLI or the `configPath` arg to `loadEnv`):

- `<env>.key` — hex secret key (`crypto.randomBytes(32)`), gitignored, never committed
- `<env>.yml.enc` — the encrypted blob committed to version control
- Transient `.coolerenv-*.tmp` files — uniquely named per run, always removed in a `finally`

### Entry points (kept separate on purpose)

1. **CLI** (`src/cli.ts`, the `bin`): shebang, banner (TTY only), and a single top-level `.catch` that prints `CoolerEnvError` messages to stderr and sets a non-zero exit code; everything else prints with a stack. Parsing and dispatch live in `src/run.ts` (`run(args)`) so tests can drive the CLI without spawning a process. `minimist` is given `string: ["e", "p"]` so `-e`/`-p` are never coerced to numbers/booleans, and commands are looked up as own properties (so `constructor` is not a command). Every command takes `-e <env>` (required) and `-p <path>` (optional).
2. **Library** (`src/index.ts`): re-exports `loadEnv`, `CoolerEnvError`, and the `Secrets`/`LoadEnvOptions` types with **no import-time side effects** — importing the package must never run the CLI. `loadEnv(env, { configPath, inject, override })` decrypts and returns the secrets; it only writes to `process.env` when `inject: true`, and by default does not override values already set.

Never move CLI side effects (banner, arg parsing) into `index.ts`; that reintroduces the coupling that forced consumers to deep-import `dist/loadEnv`.

### The shared secrets layer (`src/lib/`)

All crypto and file I/O funnel through `src/lib/secrets.ts` — do not hand-roll ciphers in commands. Encryption uses Node's built-in **`aes-256-gcm`** (authenticated). `encryptSecrets`/`decryptSecrets` are pure buffer↔object functions; `readSecrets`/`writeSecrets` add file I/O on top. `writeSecrets` produces ciphertext in memory and **atomically renames** a temp file over the encrypted file, so plaintext never touches disk. Decrypted payloads run through `sanitize` to drop prototype-polluting keys before they reach `process.env`.

The on-disk `.yml.enc` format is a single binary blob with a versioned header: `[magic "CENV"(4)][version(1)][salt(16)][iv(12)][authTag(16)][ciphertext]`. A fresh random salt + IV is generated per write, the AES key is derived from the secret key via `scrypt(password, salt)`, and GCM's auth tag means a wrong key or any tampering fails loudly (throws `CoolerEnvError`) rather than yielding garbage. The header (added in v4) lets the KDF/cipher params evolve; `decryptSecrets` reads headerless v3 blobs too (treated as version 0), so v4 reads v3 files but not vice-versa. **This format is not backward-compatible with the old cryptify/aes-256-cbc files (v2.x); v3 is a hard break.**

Other `lib/` helpers: `paths.ts` (`resolvePaths`, `validateEnvName`, `requireEnv`, `configPathOf` — env names are validated against a conservative file-name pattern in both the CLI and `loadEnv`, and `-p` is resolved with `path.resolve` so absolute paths work), `guards.ts` (`assertInitialized`, prompt validators), `errors.ts` (`CoolerEnvError`), `banner.ts`, `types.ts`.

### Tests

Jest (`ts-jest` for `.ts`, `babel-jest` for `.js`). Tests import commands directly from `src/`, run inside an isolated temp dir via `test/sandbox.ts` (`makeSandbox` chdirs into a realpath'd `os.tmpdir()` subdir so nothing touches the real repo or its `.gitignore`, and so `sandbox.dir` equals `process.cwd()` on macOS where `/var` is a symlink), and mock `inquirer.prompt`. Always assert without swallowing errors — the original init test wrapped everything in try/catch and passed even when `init` threw.
