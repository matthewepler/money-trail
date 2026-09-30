export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigError extends Error {
  readonly code = 'CONFIG_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
