export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export const notFound = (message: string) => new AppError(404, message, "NOT_FOUND");
export const unauthorized = (message = "Authentication required") =>
  new AppError(401, message, "UNAUTHORIZED");
