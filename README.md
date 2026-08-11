# Cooler-Env

[![CI](https://github.com/arsood/Cooler-Env/actions/workflows/ci.yml/badge.svg)](https://github.com/arsood/Cooler-Env/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/cooler-env.svg)](https://www.npmjs.com/package/cooler-env)
[![node](https://img.shields.io/node/v/cooler-env.svg)](https://www.npmjs.com/package/cooler-env)
[![license](https://img.shields.io/npm/l/cooler-env.svg)](./LICENSE.md)

A CLI **and** module for managing encrypted environment variables, inspired by [Ruby on Rails credentials](https://guides.rubyonrails.org/security.html#custom-credentials).

Instead of scattering plaintext `.env` files across machines and chat threads, Cooler-Env keeps your secrets in a single **encrypted blob you can safely commit to version control**, decrypted at runtime with a key that never leaves your `.gitignore`. Sensitive values spend as little time as possible in plaintext, and an intuitive CLI handles the create/edit/delete flow for you.

---

## Contents

- [How it works](#how-it-works)
- [Installation](#installation)
- [Quick start](#quick-start)
- [CLI reference](#cli-reference)
- [Programmatic API](#programmatic-api)
- [Security model](#security-model)
- [Upgrading from v2](#upgrading-from-v2)
- [Development](#development)
- [License](#license)

## How it works

Every environment (`development`, `production`, …) is backed by a trio of files inside a config directory (default `config/`):

| File               | Committed?      | Purpose                                                              |
| ------------------ | --------------- | ------------------------------------------------------------------- |
| `<env>.key`        | ❌ **Never**    | Hex secret key (`crypto.randomBytes(32)`). Auto-added to `.gitignore` on `init`. |
| `<env>.yml.enc`    | ✅ Yes           | The encrypted secrets blob. Safe to commit.                         |

Encryption uses Node's built-in, authenticated **`aes-256-gcm`**. The on-disk blob is a single binary payload — `[salt(16)][iv(12)][authTag(16)][ciphertext]` — with a fresh random salt and IV per write and the AES key derived from your secret key via `scrypt`. Any tampering or a wrong key **fails loudly** rather than returning garbage. See [Security model](#security-model) for details.

## Installation

```bash
npm install cooler-env
# or
yarn add cooler-env
```

Requires **Node.js 18+**. Ships as a CommonJS build (importable from both `require` and ESM `import`) with TypeScript types included.

## Quick start

```bash
# 1. Initialize an environment (creates config/development.key + config/development.yml.enc)
npx cooler-env init -e development

# 2. Add a secret through the interactive prompt
npx cooler-env add -e development
#   ? Key name:  API_KEY
#   ? Value:     sk_live_123...
```

```javascript
// 3. Load them in your app
import { loadEnv } from "cooler-env";

const env = await loadEnv("development");
console.log(env.API_KEY); // "sk_live_123..."
```

## CLI reference

All commands share the same two options:

| Option          | Required | Description                                                                    |
| --------------- | -------- | ------------------------------------------------------------------------------ |
| `-e <env>`      | ✅       | Environment name (e.g. `development`, `production`).                            |
| `-p <path>`     | ❌       | Directory for the key/encrypted files. Defaults to `config`.                   |

### `init`

Sets up a new environment, generating the `.key` and `.yml.enc` files and adding the key to `.gitignore`.

```bash
cooler-env init -e development
```

> ⚠️ **Never commit the `.key` file.** Anyone with it can decrypt your secrets. `init` gitignores it for you, but double-check before pushing.

### `add`

Opens an interactive prompt to add a new key/value pair.

```bash
cooler-env add -e development
```

### `edit`

Opens an interactive prompt to pick an existing key and set a new value.

```bash
cooler-env edit -e development
```

### `delete`

Opens an interactive prompt to pick a key to remove.

```bash
cooler-env delete -e development
```

## Programmatic API

### `loadEnv(env, options?)`

Decrypts an environment's secrets and resolves to a `Secrets` object (`Record<string, string>`).

By default this is a **pure read** — it returns the secrets and touches nothing global. This is the recommended usage, since it keeps load order explicit and avoids clobbering real environment variables:

```javascript
import { loadEnv } from "cooler-env";

const env = await loadEnv(process.env.NODE_ENV);
startServer({ apiKey: env.API_KEY, dbUrl: env.DATABASE_URL });
```

If you'd rather populate `process.env` globally (the classic behavior), opt in with `inject`:

```javascript
await loadEnv(process.env.NODE_ENV, { inject: true });
// process.env.API_KEY is now set — unless it was already set in the shell/CI
```

#### Options

| Option       | Type      | Default    | Description                                                                                             |
| ------------ | --------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `configPath` | `string`  | `"config"` | Directory holding the encryption key and encrypted files.                                              |
| `inject`     | `boolean` | `false`    | Also write each secret into `process.env`.                                                              |
| `override`   | `boolean` | `false`    | When injecting, overwrite variables already set in the environment. By default a shell/CI value wins.  |

#### TypeScript

Types ship with the package:

```typescript
import { loadEnv, type Secrets, type LoadEnvOptions } from "cooler-env";

const env: Secrets = await loadEnv("production", { inject: true } satisfies LoadEnvOptions);
```

#### Error handling

`loadEnv` rejects with a `CoolerEnvError` for expected failures — a missing key/encrypted file, a wrong key, or a tampered blob:

```javascript
try {
  await loadEnv("production");
} catch (err) {
  console.error(err.message); // e.g. "Encrypted file not found at config/production.yml.enc."
}
```

> **Importing the package has no side effects.** The CLI and library are kept separate, so `import { loadEnv } from "cooler-env"` never runs CLI code.

## Security model

- **Cipher:** `aes-256-gcm` (authenticated encryption) from Node's built-in `crypto`. No third-party crypto dependencies.
- **Key derivation:** the AES key is derived from your secret key with `scrypt` against a per-write random salt.
- **On-disk format:** a single binary blob — `[salt(16)][iv(12)][authTag(16)][ciphertext]`. A fresh salt + IV is generated on every write, so identical secrets never produce identical ciphertext.
- **Integrity:** GCM's auth tag means a wrong key or any tampering throws instead of yielding corrupt output.
- **No plaintext on disk:** writes produce ciphertext in memory and **atomically rename** a temp file over the encrypted file, so plaintext never lands on disk and an interrupted write can't leave a half-written file.
- **Prototype-pollution guard:** decrypted payloads are sanitized to drop `__proto__` / `constructor` / `prototype` keys before they reach your object or `process.env`.

The one rule that matters most: **keep the `.key` file out of version control.** `init` gitignores it for you.

## Upgrading from v2

**v3 is a hard break.** The encryption format changed from the old `cryptify` / `aes-256-cbc` scheme to authenticated `aes-256-gcm`, so **v2 `.yml.enc` files cannot be read by v3.** To migrate, decrypt your secrets with v2, upgrade, re-`init`, and re-add them.

The `loadEnv` signature also changed: the old positional `configPath` second argument is now part of an options object, and `loadEnv` no longer writes to `process.env` by default — pass `{ inject: true }` for the previous behavior.

## Development

```bash
yarn install      # Yarn 4 (Berry), node-modules linker
yarn build        # tsc -> dist/
yarn test         # Jest
yarn lint         # ESLint

yarn test test/loadEnv.test.ts          # a single file
yarn test -t "returns secrets"          # a single test by name
```

CI runs lint + build + test across Node 18, 20, and 22 on every push and pull request.

## License

[MIT](./LICENSE.md) © Aaron Sood
