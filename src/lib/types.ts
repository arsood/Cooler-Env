export type Secrets = Record<string, string>;

export interface Argv {
  _: string[];
  e?: string | number | boolean;
  p?: string | number | boolean;
  [key: string]: unknown;
}

export interface Paths {
  configDir: string;
  keyFile: string;
  encryptedFile: string;
}
