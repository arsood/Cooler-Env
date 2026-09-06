// Characters that are safe to print in a bare `KEY=value` line — readable and
// unambiguous to both a human and a line-oriented parser, and safe to `source`
// in a shell as-is. Anything else (spaces, quotes, `#`, `=`, `$`, newlines, an
// empty value) is JSON-quoted so it round-trips without breaking the line.
const BARE_VALUE = /^[A-Za-z0-9_@%+./:-]+$/;

/**
 * Render a secret value for a `KEY=value` line. Bare when it is safe to read
 * back verbatim; otherwise JSON-quoted (`"..."` with `\n`, `\"`, `\\`, etc.
 * escaped) so newlines can't spill onto another line or spoof a second key.
 */
export const formatEnvValue = (value: string): string =>
  BARE_VALUE.test(value) ? value : JSON.stringify(value);
