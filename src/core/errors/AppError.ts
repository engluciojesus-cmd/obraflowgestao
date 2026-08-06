export class AppError extends Error {
  public readonly code?: string | number;
  public readonly meta?: any;

  constructor(message: string, code?: string | number, meta?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.meta = meta;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export default AppError;
