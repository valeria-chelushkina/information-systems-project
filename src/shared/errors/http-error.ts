export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: unknown): HttpError {
    return new HttpError(400, code, message, details);
  }

  static notFound(code: string, message: string): HttpError {
    return new HttpError(404, code, message);
  }

  static conflict(code: string, message: string): HttpError {
    return new HttpError(409, code, message);
  }
}
