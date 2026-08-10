import chalk from "chalk";
import figlet from "figlet";

/** Print the Cooler Env ASCII banner. */
export const printBanner = (): void => {
  console.log(
    chalk.green(figlet.textSync("Cooler Env", { horizontalLayout: "full" }))
  );
};
