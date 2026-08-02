import type { GroundedResult } from "@discharge-guide/shared-types";

export const LOW_CONFIDENCE_WARNING = "Please check the original document.";

export function grounded<T>(
  data: T,
  confidence: number,
  sourceLines: number[] = [],
  isPlaceholder = true
): GroundedResult<T> {
  return {
    success: true,
    data,
    confidence,
    sourceLines,
    isPlaceholder,
    ...(confidence < 80 ? { warning: LOW_CONFIDENCE_WARNING } : {})
  };
}
