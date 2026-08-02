import type { AskGroundedInput, AskGroundedResult } from "@discharge-guide/shared-types";

// Typed handoff mock only. Person A replaces this implementation.
export async function askGrounded(_input: AskGroundedInput): Promise<AskGroundedResult> {
  return {
    answer:
      "The document Q&A pipeline is not available yet. Please check the original document or contact your healthcare provider.",
    confidence: 0,
    source: { documentId: _input.documentId, sourceLines: [] }
  };
}
