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
   * True when the encoding may not survive a round-trip through the target
   * parsers (npm `dotenv`, Node's `util.parseEnv`). Two cases set it:
   *   - the double-quoted tier, whose backslash escapes those parsers don't
   *     decode back (they only expand `\n`/`\r`), and
   *   - any value containing a carriage return, which `dotenv` normalizes to
   *     `\n` and `util.parseEnv` strips entirely, even inside quotes.
   * The caller should warn, naming the key, and point to `--shell`.
   */
  lossy: boolean;
}

/**
 * Render a secret value for a dotenv (`KEY=value`) line, targeting the npm
 * `dotenv` parser and Node's `util.parseEnv`. Other ecosystems' loaders
 * (python-dotenv, Ruby dotenv, Docker Compose) apply different quoting and
 * interpolation rules; `--shell` is the loader-independent option.
 *
 * Tiers, in order:
 *   1. bare            — when every character is in `BARE_VALUE`.
 *   2. single-quoted   — `'…'` with raw newlines, when the value has no `'`.
 *                        The target parsers treat single quotes literally, so
 *                        this round-trips anything else (incl. `$`, backticks,
 *                        `\`) for them.
 *   3. double-quoted   — `"…"` escaping `\`, `"`, and also `$`/backtick, raw
 *                        newlines. Marked `lossy` (the target parsers don't
 *                        decode the escapes). Escaping `$`/backtick is defense
 *                        in depth: an interpolating loader (dotenv-expand,
 *                        Compose, python-/Ruby dotenv) would otherwise expand —
 *                        or, for Ruby, execute `$(…)` in — a value that lands
 *                        here precisely because it contains a `'` and so can't
 *                        use the safe single-quoted tier.
 */
export const formatDotenvValue = (value: string): DotenvFormat => {
  // A carriage return is mangled by the target parsers even when quoted, so it
  // taints whichever quoted tier is used below.
  const fragile = value.includes("\r");

  if (BARE_VALUE.test(value)) return { text: value, lossy: false };

  if (!value.includes("'")) return { text: `'${value}'`, lossy: fragile };

  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/([$`])/g, "\\$1");
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
