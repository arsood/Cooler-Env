// Characters that are safe to print bare in a `KEY=value` line — readable and
// unambiguous to a human, a line-oriented `.env` parser, and a POSIX shell
// alike. Anything else (spaces, quotes, `#`, `=`, `$`, backticks, newlines, an
// empty value) must be quoted so it round-trips without breaking the line or,
// worse, executing when the line is sourced.
const BARE_VALUE = /^[A-Za-z0-9_@%+./:-]+$/;

/**
 * Render a secret value for a human-facing `KEY=value` line (`list --values`).
 * Bare when it reads back verbatim; otherwise JSON-quoted so a newline (or `=`,
 * spaces, quotes) can't break the one-key-per-line output or spoof another key.
 *
 * This is a *display* format, not an interchange one: JSON quoting does not
 * match `.env` syntax and, because `$`/backticks stay live inside the JSON
 * double quotes, the output is NOT safe to `source`. Use `export` for a file
 * you intend to load — only the bare branch here is source-safe.
 */
export const formatDisplayValue = (value: string): string =>
  BARE_VALUE.test(value) ? value : JSON.stringify(value);

/** Result of rendering a value for a dotenv line. */
export interface DotenvFormat {
  /** The formatted value, ready to place after `KEY=`. */
  text: string;
  /**
   * True when the lossy double-quoted tier was used. The dotenv npm parser
   * treats a backslash in a double-quoted value literally (it only expands
   * `\n`/`\r`/`\t`), so `\"` and `\\` don't decode back to `"` and `\` — the
   * value won't fully round-trip. The caller should warn, naming the key.
   */
  lossy: boolean;
}

/**
 * Render a secret value for a dotenv (`KEY=value`) line.
 *
 * Tiers, in order:
 *   1. bare            — when every character is in `BARE_VALUE`.
 *   2. single-quoted   — `'…'` with raw newlines, when the value has no `'`.
 *                        dotenv treats single quotes as fully literal, so this
 *                        round-trips anything (including `$`, backticks, `\`).
 *   3. double-quoted   — `"…"` escaping `\` and `"`, raw newlines. Marked
 *                        `lossy` because dotenv can't decode the escapes back.
 */
export const formatDotenvValue = (value: string): DotenvFormat => {
  if (BARE_VALUE.test(value)) return { text: value, lossy: false };

  if (!value.includes("'")) return { text: `'${value}'`, lossy: false };

  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return { text: `"${escaped}"`, lossy: true };
};

/**
 * Render a secret value for a POSIX shell `export KEY=value` line. Bare when
 * safe; otherwise single-quoted with each `'` written as `'\''`, which
 * round-trips *every* byte in sh/bash/zsh (no `$`, backtick, or backslash
 * expansion happens inside single quotes).
 */
export const formatShellValue = (value: string): string => {
  if (BARE_VALUE.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
};
