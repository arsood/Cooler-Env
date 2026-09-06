import fs from "fs";
import path from "path";
import chalk from "chalk";
import crypto from "crypto";
import inquirer from "inquirer";

import { Argv } from "../lib/types";
import { resolvePaths, requireEnv, configPathOf } from "../lib/paths";
import { writeSecrets } from "../lib/secrets";

/**
 * Add the key file to the current directory's .gitignore, creating the file
 * and de-duplicating. The entry is the key's path relative to cwd in POSIX
 * form (git pattern syntax), so `-p ./config/` still yields `config/dev.key`.
 * A key outside cwd cannot be expressed in this .gitignore, so warn instead.
 */
const ensureGitignored = (keyFile: string): void => {
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  // Compare real paths so a symlinked cwd or config dir isn't misread as
  // "outside" the project.
  const relative = path.relative(
    fs.realpathSync(process.cwd()),
    fs.realpathSync(keyFile)
  );

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    console.log(
      chalk.yellow(
        `Warning: ${keyFile} is outside the current directory, so it was NOT added to .gitignore. Make sure it is never committed.`
      )
    );
    return;
  }

  const entry = relative.split(path.sep).join("/");

  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";

  const alreadyIgnored = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === entry);

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

  const newKey = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(paths.keyFile, newKey, { mode: 0o600 });
  console.log(chalk.green(`Wrote encryption key to: ${paths.keyFile}`));

  ensureGitignored(paths.keyFile);

  await writeSecrets(paths, {});
  console.log(chalk.green(`Wrote encrypted file to: ${paths.encryptedFile}`));

  console.log("Init complete! 💯");
};

export default init;
