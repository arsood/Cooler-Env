const edit = (argv) => {
  clear();

  console.log(
    chalk.green(
      figlet.textSync("Cooler Env", { horizontalLayout: "full" })
    )
  );
}

module.exports = edit;
