import type {
  AiFunctionResult,
  StructuredAiError,
} from "@discharge/shared-types";
import { config } from "../config.js";

export type AiProviderSlot = "openai" | "gemini_primary" | "gemini_fallback";

export interface AiProviderContext {
  apiKey: string;
  family: "openai" | "gemini";
  slot: AiProviderSlot;
}

export interface AiProviderCredentials {
  openai?: string;
  geminiPrimary?: string;
  geminiFallback?: string;
}

export type AiProviderOperation<T> = (context: AiProviderContext) => Promise<T>;

export type AiProviderFailureKind =
  | "rate_limit"
  | "quota_exhausted"
  | "timeout"
  | "network"
  | "server"
  | "validation"
  | "authentication"
  | "authorization"
  | "malformed_request"
  | "programming"
  | "parsing";

export class AiProviderFailure extends Error {
  constructor(
    public readonly kind: AiProviderFailureKind,
    message = "AI provider request failed",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

const PROVIDER_UNAVAILABLE: StructuredAiError = {
  code: "AI_PROVIDER_UNAVAILABLE",
  message: "AI processing is temporarily unavailable.",
  retryable: true,
};

const VALIDATION_FAILED: StructuredAiError = {
  code: "AI_VALIDATION_FAILED",
  message: "The request could not be processed safely.",
  retryable: false,
};

const retryableKinds = new Set<AiProviderFailureKind>([
  "rate_limit",
  "quota_exhausted",
  "timeout",
  "network",
  "server",
]);

const retryableCodes = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
  "RATE_LIMIT_EXCEEDED",
  "REQUEST_TIMEOUT",
  "RESOURCE_EXHAUSTED",
  "SERVICE_UNAVAILABLE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function statusCode(error: unknown) {
  if (!isRecord(error)) return undefined;
  const status = error.statusCode ?? error.status;
  return typeof status === "number" ? status : undefined;
}

function errorCode(error: unknown) {
  if (!isRecord(error)) return undefined;
  const code = error.code;
  return typeof code === "string" ? code.toUpperCase() : undefined;
}

export function isRetryableAiProviderFailure(error: unknown) {
  if (error instanceof AiProviderFailure) {
    return retryableKinds.has(error.kind);
  }
  if (isRecord(error) && error.retryable === true) return true;
  const status = statusCode(error);
  if (
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500 && status < 600)
  ) {
    return true;
  }
  const name = error instanceof Error ? error.name : undefined;
  if (name === "AbortError" || name === "TimeoutError") return true;
  const code =
    errorCode(error) ?? (isRecord(error) ? errorCode(error.cause) : undefined);
  return code !== undefined && retryableCodes.has(code);
}

function isValidationFailure(error: unknown) {
  return (
    (error instanceof AiProviderFailure && error.kind === "validation") ||
    (isRecord(error) && error.code === "AI_VALIDATION_FAILED")
  );
}

function configuredCredentials(): AiProviderCredentials {
  return {
    openai: config.OPENAI_API_KEY,
    geminiPrimary: config.GEMINI_API_KEY_PRIMARY,
    geminiFallback: config.GEMINI_API_KEY_FALLBACK,
  };
}

function normalizedCredential(value: string | undefined) {
  const credential = value?.trim();
  return credential ? credential : undefined;
}

export async function runAiProviderWaterfall<T>(
  operation: AiProviderOperation<T>,
  credentials: AiProviderCredentials = configuredCredentials(),
): Promise<AiFunctionResult<T>> {
  const providers: Array<{
    apiKey?: string;
    family: AiProviderContext["family"];
    slot: AiProviderSlot;
  }> = [
    {
      slot: "openai",
      family: "openai",
      apiKey: normalizedCredential(credentials.openai),
    },
    {
      slot: "gemini_primary",
      family: "gemini",
      apiKey: normalizedCredential(credentials.geminiPrimary),
    },
    {
      slot: "gemini_fallback",
      family: "gemini",
      apiKey: normalizedCredential(credentials.geminiFallback),
    },
  ];

  for (const provider of providers) {
    if (!provider.apiKey) continue;
    try {
      return await operation({
        apiKey: provider.apiKey,
        family: provider.family,
        slot: provider.slot,
      });
    } catch (error) {
      if (isValidationFailure(error)) return { ...VALIDATION_FAILED };
      if (!isRetryableAiProviderFailure(error)) throw error;
    }
  }

  return { ...PROVIDER_UNAVAILABLE };
}
