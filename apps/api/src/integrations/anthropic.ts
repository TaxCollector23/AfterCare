import { config } from "../config.js";
import { LOW_CONFIDENCE_WARNING } from "../pipeline/types.js";

export interface AskResult {
  answer: string;
  confidence: number;
  sourceLines: number[];
  source: "document" | "general_education" | "unavailable";
  warning?: string;
  isPlaceholder: boolean;
}

export function anthropicStatus() {
  return {
    provider: "anthropic",
    configured: Boolean(config.ANTHROPIC_API_KEY) && !config.MOCK_INTEGRATIONS,
    mode: config.MOCK_INTEGRATIONS ? "mock" : "live"
  } as const;
}

export async function askGroundedQuestion(
  _question: string,
  sourceText: string
): Promise<AskResult> {
  if (!sourceText) {
    return {
      answer:
        "I cannot answer from the discharge document yet because OCR and extraction are not configured. Please check the original document or contact your healthcare provider.",
      confidence: 0,
      sourceLines: [],
      source: "unavailable",
      warning: LOW_CONFIDENCE_WARNING,
      isPlaceholder: true
    };
  }

  if (config.MOCK_INTEGRATIONS || !config.ANTHROPIC_API_KEY) {
    return {
      answer:
        "The AI provider is running in placeholder mode. No clinical answer was generated.",
      confidence: 0,
      sourceLines: [],
      source: "unavailable",
      warning: LOW_CONFIDENCE_WARNING,
      isPlaceholder: true
    };
  }

  throw new Error("Live Anthropic calls are not enabled in this scaffold.");
}
