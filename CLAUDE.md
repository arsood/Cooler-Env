# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Build: `yarn build` (runs `tsc`, emitting to `dist/`). The package is published from `dist/`, so build before testing CLI/module behavior against compiled output.
- Test: `yarn test` (Jest)
- Run a single test: `yarn test test/init.test.ts` or `yarn test -t "Should create a key file"`
- Package manager is Yarn 4 (Berry, `node-modules` linker). Use `yarn`, not `npm`, for installs.
- Node: `.nvmrc` pins `lts/*`.

There is no lint script wired into `package.json`; ESLint (`.eslintrc.json`, prettier-based) is configured but must be run manually via `npx eslint`.

## Architecture

Cooler-Env is both a CLI and an importable module for managing encrypted environment variables (inspired by Rails credentials). Everything hinges on a per-environment trio of files inside a config directory (default `config/`, overridable with `-p` on the CLI or the `configPath` arg to `loadEnv`):

- `<env>.key` — hex secret key (`crypto.randomBytes(32)`), gitignored, never committed
- `<env>.yml.enc` — the encrypted blob committed to version control
- Transient `.coolerenv-*.tmp` files — uniquely named per run, always removed in a `finally`

### Entry points (kept separate on purpose)

1. **CLI** (`src/cli.ts`, the `bin`): shebang + `minimist` dispatch to `src/commands/{init,add,edit,delete}.ts`. A single top-level `.catch` prints `CoolerEnvError` messages cleanly and sets a non-zero exit code; everything else prints with a stack. Every command takes `-e <env>` (required) and `-p <path>` (optional).
2. **Library** (`src/index.ts`): re-exports `loadEnv` (and the `Secrets` type) with **no import-time side effects** — importing the package must never run the CLI. `loadEnv(env, configPath?)` decrypts and injects each key into `process.env`.

Never move CLI side effects (banner, arg parsing) into `index.ts`; that reintroduces the coupling that forced consumers to deep-import `dist/loadEnv`.

### The shared secrets layer (`src/lib/`)

All crypto and file I/O funnel through `src/lib/secrets.ts` — do not hand-roll ciphers in commands. Encryption uses Node's built-in **`aes-256-gcm`** (authenticated). `encryptSecrets`/`decryptSecrets` are pure buffer↔object functions; `readSecrets`/`writeSecrets` add file I/O on top. `writeSecrets` produces ciphertext in memory and **atomically renames** a temp file over the encrypted file, so plaintext never touches disk. Decrypted payloads run through `sanitize` to drop prototype-polluting keys before they reach `process.env`.

The on-disk `.yml.enc` format is a single binary blob: `[salt(16)][iv(12)][authTag(16)][ciphertext]`. A fresh random salt + IV is generated per write, the AES key is derived from the secret key via `scrypt(password, salt)`, and GCM's auth tag means a wrong key or any tampering fails loudly (throws `CoolerEnvError`) rather than yielding garbage. **This format is not backward-compatible with the old cryptify/aes-256-cbc files (v2.x); v3 is a hard break.**

Other `lib/` helpers: `paths.ts` (`resolvePaths`, `requireEnv`, `configPathOf`), `guards.ts` (`assertInitialized`, prompt validators), `errors.ts` (`CoolerEnvError`), `banner.ts`, `types.ts`.

### Tests

Jest (`ts-jest` for `.ts`, `babel-jest` for `.js`). Tests import commands directly from `src/`, run inside an isolated temp dir via `test/sandbox.ts` (`makeSandbox` chdirs into `os.tmpdir()` so nothing touches the real repo or its `.gitignore`), and mock `inquirer.prompt`. Always assert without swallowing errors — the original init test wrapped everything in try/catch and passed even when `init` threw.
