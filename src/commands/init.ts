import fs from "fs";
import path from "path";
import chalk from "chalk";
import crypto from "crypto";
import inquirer from "inquirer";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { writeSecrets } from "../lib/secrets";

const warn = (message: string): void => console.error(chalk.yellow(message));

/**
 * Work out the .gitignore pattern for a key file, or `undefined` (with a
 * warning) when no pattern in cwd's .gitignore could match it.
 *
 * The pattern is the key's real path relative to cwd in POSIX form, anchored
 * with a leading `/` so it only matches that exact file, with gitignore
 * metacharacters (`#`, `!`, `[`, `]`, `*`, `?`, trailing space) escaped.
 */
export const gitignoreEntryFor = (
  configDir: string,
  keyName: string
): string | undefined => {
  // Compare real paths so a symlinked cwd or config dir isn't misread as
  // "outside" the project.
  const relativeDir = path.relative(
    fs.realpathSync(process.cwd()),
    fs.realpathSync(configDir)
  );
  const relative = path.join(relativeDir, keyName);
  const keyFile = path.join(configDir, keyName);

  if (
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    warn(
      `Warning: ${keyFile} is outside the current directory, so it was NOT added to .gitignore. Make sure it is never committed.`
    );
    return undefined;
  }

  const segments = relative.split(path.sep);

  if (segments.some((segment) => segment.includes("\\"))) {
    warn(
      `Warning: ${keyFile} contains a backslash, which cannot be expressed in .gitignore, so it was NOT added. Make sure it is never committed.`
    );
    return undefined;
  }

  return (
    "/" +
    segments
      .map((segment) =>
        segment.replace(/[#![\]*?]/g, (m) => `\\${m}`).replace(/ $/, "\\ ")
      )
      .join("/")
  );
};

/** Append `entry` to cwd's .gitignore, creating the file and de-duplicating. */
const ensureGitignored = (entry: string): void => {
  const gitignorePath = path.join(process.cwd(), ".gitignore");

  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";

  // Also accept the unanchored form written by earlier versions.
  const alreadyIgnored = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === entry || line.trim() === entry.slice(1));

  if (alreadyIgnored) return;

  // Separate from existing content with a blank line; no leading blank line
  // when creating the file.
  const separator = !existing.length ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  fs.appendFileSync(
    gitignorePath,
    `${separator}# Cooler-Env secret key\n${entry}\n`
  );

  console.log(chalk.green(`Added ${entry} to .gitignore`));
};

const init = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const paths = resolvePaths(env, configPathOf(argv));

  const alreadyExists =
    fs.existsSync(paths.keyFile) || fs.existsSync(paths.encryptedFile);

  if (alreadyExists) {
    const { confirmOverwrite } = await inquirer.prompt<{
      confirmOverwrite: boolean;
    }>([
      {
        name: "confirmOverwrite",
        type: "confirm",
        default: false,
        message: chalk.red(
          `Environment "${env}" already exists. Re-initializing generates a NEW key and ERASES all existing secrets. Continue?`
        ),
      },
    ]);

    if (!confirmOverwrite) {
      console.log(chalk.yellow("Init cancelled."));
      return;
    }
  }

  if (!fs.existsSync(paths.configDir)) {
    fs.mkdirSync(paths.configDir, { recursive: true });
  }

  // Resolve the .gitignore pattern before writing anything so a bad layout is
  // reported up front rather than after the key exists.
  const entry = gitignoreEntryFor(paths.configDir, path.basename(paths.keyFile));

  const newKey = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(paths.keyFile, newKey, { mode: 0o600 });
  console.log(chalk.green(`Wrote encryption key to: ${paths.keyFile}`));

  if (entry !== undefined) {
    try {
      ensureGitignored(entry);
    } catch (err) {
      warn(
        `Warning: could not update .gitignore (${(err as Error).message}). Add ${entry} to it manually and make sure the key is never committed.`
      );
    }
  }

  await writeSecrets(paths, {});
  console.log(chalk.green(`Wrote encrypted file to: ${paths.encryptedFile}`));

  console.log("Init complete! 💯");
};

export default init;
