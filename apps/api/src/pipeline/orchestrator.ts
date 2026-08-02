import type { PipelineEmit, RecoveryPlan } from "@discharge-guide/shared-types";

// Typed handoff mock only. Person A replaces this implementation.
export async function runPipeline(
  documentId: string,
  emit: PipelineEmit
): Promise<RecoveryPlan> {
  emit({ stage: "ocr", status: "started", data: null });
  emit({ stage: "ocr", status: "completed", data: { isPlaceholder: true } });
  return {
    documentId,
    status: "ready",
    disclaimer: "This app explains instructions; it never replaces medical advice.",
    medications: [],
    appointments: [],
    warnings: [],
    timeline: [],
    isPlaceholder: true
  };
}
