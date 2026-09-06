export type Secrets = Record<string, string>;

/**
 * Parsed CLI arguments. `-e` and `-p` are declared as string options to
 * minimist, so they are `string` when given once (`""` for a bare flag),
 * `string[]` when repeated, `undefined` when absent, and `false` for the
 * `--no-e` / `--no-p` negation forms.
 */
export interface Argv {
  _: string[];
  e?: string | string[] | false;
  p?: string | string[] | false;
  [key: string]: unknown;
}

export interface Paths {
  configDir: string;
  keyFile: string;
  encryptedFile: string;
}
