#!/usr/bin/env node

import chalk from "chalk";

import { printBanner } from "./lib/banner";
import { CoolerEnvError } from "./lib/errors";
import { run } from "./run";

const args = process.argv.slice(2);

// Only decorate interactive sessions; keep piped stdout clean. Skip the banner
// for --help/--version so their output stands alone.
const isInfoOnly = args.some((a) =>
  ["-h", "--help", "-v", "--version"].includes(a),
);
if (process.stdout.isTTY && !isInfoOnly) printBanner();

run(args).catch((error: unknown) => {
  process.exitCode = 1;

  if (error instanceof CoolerEnvError) {
    console.error(chalk.red(error.message));
    return;
  }

  // inquirer throws this when the user aborts a prompt (e.g. Ctrl+C). Use the
  // conventional SIGINT exit code so scripts can tell an interrupt from an error.
  if (error instanceof Error && error.name === "ExitPromptError") {
    process.exitCode = 130;
    console.error(chalk.yellow("Cancelled."));
    return;
  }

  console.error(chalk.red("Cooler-Env: an unexpected error occurred."));
  console.error(error);
});
