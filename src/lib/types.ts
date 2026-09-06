export type Secrets = Record<string, string>;

/**
 * Parsed CLI arguments. `-e` and `-p` are declared as string options to
 * minimist, so they are `string` when given once, `string[]` when repeated,
 * and `undefined` when absent.
 */
export interface Argv {
  _: string[];
  e?: string | string[];
  p?: string | string[];
  [key: string]: unknown;
}

export interface Paths {
  configDir: string;
  keyFile: string;
  encryptedFile: string;
}
