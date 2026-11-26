export class MigrationError extends Error {
  constructor(code, exitCode = 1, diagnostics) {
    super(code);
    this.name = 'MigrationError';
    this.code = code;
    this.exitCode = exitCode;
    if (diagnostics) this.diagnostics = diagnostics;
  }
}

export const fail = (code, exitCode, diagnostics) => { throw new MigrationError(code, exitCode, diagnostics); };
