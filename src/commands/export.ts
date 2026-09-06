import chalk from "chalk";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { assertInitialized, KEY_NAME_PATTERN } from "../lib/guards";
import { readSecrets } from "../lib/secrets";
import { CoolerEnvError } from "../lib/errors";
import { formatDotenvValue, formatShellValue } from "../lib/dotenv";

// A key printable in a dotenv line: no whitespace, `=`, `#`, quotes, or
// newlines that would break the line or start a comment. Looser than a shell
// identifier because `.env` loaders accept `.` and `-` in names.
const DOTENV_KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;

/**
 * Print an environment's secrets as a `.env` file (default) or a sourceable
 * shell script (`--shell`). stdout only — redirect with `>` or wrap in
 * `eval "$(…)"`. Keys are validated up front so a bad name aborts before a
 * single line is written: a failed `eval`/redirect is then a clean no-op
 * rather than a half-written file.
 */
const exportCmd = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));
  assertInitialized(paths, env);

  const secrets = await readSecrets(paths);
  const keys = Object.keys(secrets).sort();

  if (keys.length === 0) {
    // Diagnostic, not data — keep stdout empty so `export > .env` yields an
    // empty file and `eval "$(…)"` runs nothing.
    console.error(chalk.yellow("No keys set."));
    return;
  }

  const shell = argv.shell === true;

  // Fail-fast validation, before any stdout write. Shell mode needs a real
  // identifier (`export FOO-BAR=…` is a syntax error); dotenv mode is looser.
  const pattern = shell ? KEY_NAME_PATTERN : DOTENV_KEY_PATTERN;
  const invalid = keys.filter((key) => !pattern.test(key));
  if (invalid.length) {
    const dialect = shell ? "a shell variable" : "a dotenv key";
    throw new CoolerEnvError(
      `Cannot export: ${invalid.join(", ")} ${invalid.length === 1 ? "is not a valid name for" : "are not valid names for"} ${dialect}.`,
    );
  }

  const lines: string[] = [];
  const lossyKeys: string[] = [];

  for (const key of keys) {
    if (shell) {
      lines.push(`export ${key}=${formatShellValue(secrets[key])}`);
    } else {
      const { text, lossy } = formatDotenvValue(secrets[key]);
      if (lossy) lossyKeys.push(key);
      lines.push(`${key}=${text}`);
    }
  }

  for (const key of lossyKeys) {
    console.error(
      chalk.yellow(
        `Warning: value for "${key}" contains a single quote; its .env encoding uses backslash escapes that some dotenv parsers won't decode. Use --shell for an exact copy.`,
      ),
    );
  }

  console.log(lines.join("\n"));
};

export default exportCmd;
