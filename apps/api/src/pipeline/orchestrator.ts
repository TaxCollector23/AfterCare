import type {
  AiFunctionResult,
  PipelineEmit,
  PipelineStageEvent,
  RecoveryPlan,
} from "@discharge/shared-types";
import { repository } from "../db/repository.js";
import { sanitizeAiError } from "../errors.js";
import { loadDocument } from "../integrations/storage.js";
import { runPipeline as runPipelineCore } from "./index.js";

function forwardPipelineEvent(emit: PipelineEmit, event: PipelineStageEvent) {
  emit({
    stage: event.stage,
    status:
      event.status === "done"
        ? "completed"
        : event.status === "error"
          ? "failed"
          : "started",
    data: event.data ?? null,
    ...(event.status === "error"
      ? { error: sanitizeAiError(event.error) }
      : {}),
  });
}

/** API-facing adapter that preserves runPipeline(documentId, emit). */
export async function runPipeline(
  documentId: string,
  emit: PipelineEmit,
): Promise<AiFunctionResult<RecoveryPlan>> {
  const document = repository.findDocumentById(documentId);
  if (!document) {
    return {
      code: "AI_VALIDATION_FAILED",
      message: "The request could not be processed safely.",
      retryable: false,
    };
  }

  try {
    return await runPipelineCore(
      {
        documentId,
        buffer: await loadDocument(document.storageKey),
        mimeType: document.mimeType,
      },
      (event) => forwardPipelineEvent(emit, event),
    );
  } catch (error) {
    return sanitizeAiError(error);
  }
}
