import fs from "fs";
import path from "path";

/**
 * Read the package version. `__dirname` is `dist/lib` in the published build
 * and `src/lib` under ts-jest — both are two levels below `package.json`.
 */
export const getVersion = (): string => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
    ) as { version?: string };
    return String(pkg.version ?? "unknown");
  } catch {
    return "unknown";
  }
};

/** The `--help` text. */
export const helpText = (): string =>
  `cooler-env — manage encrypted environment variables

Usage:
  cooler-env <command> -e <env> [-p <dir>] [options]

Commands:
  init     Create a new environment (generates the key + encrypted file)
  add      Add a new key/value pair (interactive, or -k/-v for scripts)
  edit     Change an existing key's value
  delete   Remove one or more keys
  list     List key names (add --values to include values)

Options:
  -e <env>          Environment name (required), e.g. development, production
  -p <dir>          Config directory (default: config)
  -k, --key <name>  add: the key name (non-interactive)
  -v, --value <val> add: the value (non-interactive); omit to read it from stdin
  --show            add/edit: type the value in the clear (default: hidden)
  --values          list: also print values
  -h, --help        Show this help
  --version         Show the version

Examples:
  cooler-env init -e development
  cooler-env add -e development
  cooler-env add -e development -k API_KEY -v sk_live_123
  printf %s "$SECRET" | cooler-env add -e production -k API_KEY
  cooler-env list -e development --values`;
