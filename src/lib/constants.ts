/**
 * Keys that would poison `Object.prototype` if a decrypted payload were ever
 * spread onto another object (e.g. `process.env`). Rejected as key names on
 * `add` and dropped from any decrypted payload in `sanitize`. Shared so the
 * validation and the sanitizer can never drift apart.
 */
export const DANGEROUS_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);
