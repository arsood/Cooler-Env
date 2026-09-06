import chalk from "chalk";

// Pre-rendered "Cooler Env" (figlet, Standard font, full layout). Inlined so
// the package doesn't depend on figlet (~7 MB) just to draw a banner that is
// only ever shown on an interactive TTY (see cli.ts).
const BANNER = [
  "   ____                   _                   _____",
  "  / ___|   ___     ___   | |   ___   _ __    | ____|  _ __   __   __",
  " | |      / _ \\   / _ \\  | |  / _ \\ | '__|   |  _|   | '_ \\  \\ \\ / /",
  " | |___  | (_) | | (_) | | | |  __/ | |      | |___  | | | |  \\ V /",
  "  \\____|  \\___/   \\___/  |_|  \\___| |_|      |_____| |_| |_|   \\_/",
].join("\n");

/** Print the Cooler Env ASCII banner. */
export const printBanner = (): void => {
  console.log(chalk.green(BANNER));
};
