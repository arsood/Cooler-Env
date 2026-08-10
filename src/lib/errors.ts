/**
 * Represents an expected, user-facing failure (bad input, missing files, etc.).
 * The CLI prints these as a clean message; anything else is treated as an
 * unexpected error and printed with its stack for debugging.
 */
export class CoolerEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoolerEnvError";
  }
}
