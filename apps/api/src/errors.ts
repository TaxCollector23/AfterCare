import type { AiErrorCode, StructuredAiError } from "@discharge-guide/shared-types";

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

const TEMPORARY_UNAVAILABLE = "AI processing is temporarily unavailable.";
const VALIDATION_FAILED = "The request could not be processed safely.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function sanitizeAiError(error: unknown): StructuredAiError {
  const rawCode = isRecord(error) && typeof error.code === "string" ? error.code : undefined;
  const rawRetryable = isRecord(error) && typeof error.retryable === "boolean" ? error.retryable : undefined;

  if (rawCode === "AI_VALIDATION_FAILED") {
    return { code: rawCode, message: VALIDATION_FAILED, retryable: false };
  }
  if (rawCode === "AI_PROVIDER_CONFIG_MISSING") {
    return {
      code: rawCode,
      message: "AI processing is not configured.",
      retryable: false
    };
  }
  if (rawCode === "AI_PROVIDER_OUTAGE") {
    return { code: rawCode, message: TEMPORARY_UNAVAILABLE, retryable: true };
  }
  if (rawCode === "AI_PROVIDER_UNAVAILABLE") {
    return {
      code: rawCode,
      message: TEMPORARY_UNAVAILABLE,
      retryable: rawRetryable ?? true
    };
  }
  return { code: "AI_PROVIDER_UNAVAILABLE", message: TEMPORARY_UNAVAILABLE, retryable: true };
}

export class AiApiError extends Error {
  readonly statusCode: number;

  constructor(public readonly publicError: StructuredAiError) {
    super(publicError.message);
    this.statusCode = publicError.code === "AI_VALIDATION_FAILED" ? 422 : 503;
  }
}

export function toAiApiError(error: unknown) {
  return new AiApiError(sanitizeAiError(error));
}

export function isStructuredAiError(value: unknown): value is StructuredAiError {
  if (!isRecord(value)) return false;
  const codes: AiErrorCode[] = [
    "AI_PROVIDER_CONFIG_MISSING",
    "AI_PROVIDER_OUTAGE",
    "AI_PROVIDER_UNAVAILABLE",
    "AI_VALIDATION_FAILED"
  ];
  return (
    typeof value.code === "string" &&
    codes.includes(value.code as AiErrorCode) &&
    typeof value.message === "string" &&
    typeof value.retryable === "boolean"
  );
}
