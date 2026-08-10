import fs from "fs";
import path from "path";
import chalk from "chalk";
import crypto from "crypto";
import inquirer from "inquirer";

import { Argv } from "../lib/types";
import {
  resolvePaths,
  requireEnv,
  configPathOf,
  DEFAULT_CONFIG_DIR,
} from "../lib/paths";
import { writeSecrets } from "../lib/secrets";

/** Add the key file to .gitignore, creating the file and de-duplicating. */
const ensureGitignored = (relativeDir: string, env: string): void => {
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  const entry = `${relativeDir}/${env}.key`;

  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";

  const alreadyIgnored = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === entry);

  if (alreadyIgnored) return;

  const prefix = existing.length && !existing.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(gitignorePath, `${prefix}\n# Cooler-Env secret key\n${entry}\n`);

  console.log(chalk.green(`Added ${entry} to .gitignore`));
};

const init = async (argv: Argv): Promise<void> => {
  const env = requireEnv(argv);
  const relativeDir = configPathOf(argv) ?? DEFAULT_CONFIG_DIR;
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

  ensureGitignored(relativeDir, env);

  await writeSecrets(paths, {});
  console.log(chalk.green(`Wrote encrypted file to: ${paths.encryptedFile}`));

  console.log("Init complete! 💯");
};

export default init;
