export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export type ImportErrorCode =
  'IMPORT_MALFORMED_FILE' | 'IMPORT_UNSUPPORTED_FORMAT' | 'IMPORT_INVALID_ROW';

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImportError';
    this.code = code;
  }
}

export class ConfigError extends Error {
  readonly code = 'CONFIG_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
