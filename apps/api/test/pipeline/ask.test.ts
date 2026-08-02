import { beforeEach, describe, it, expect, vi } from "vitest";
import type { AskGroundedResult } from "@discharge-guide/shared-types";
import type { OcrResult } from "../../src/pipeline/types.js";

const { callJsonMock, runOcrMock, loadDocumentMock } = vi.hoisted(() => ({
  callJsonMock: vi.fn(),
  runOcrMock: vi.fn(),
  loadDocumentMock: vi.fn(),
}));
vi.mock("../../src/integrations/openai.js", () => ({ callJson: callJsonMock }));
vi.mock("../../src/pipeline/ocr.js", () => ({ runOcr: runOcrMock }));
vi.mock("../../src/integrations/storage.js", () => ({
  loadDocument: loadDocumentMock,
}));

import { askGrounded } from "../../src/pipeline/ask.js";
import { repository } from "../../src/db/repository.js";
import { resetOcrCache } from "../../src/cache/index.js";

function makeOcr(lines: string[]): OcrResult {
  return {
    lines: lines.map((text, idx) => ({ line: idx + 1, text, confidence: 95 })),
    text: lines.join("\n"),
    pageCount: 1,
  };
}

const successfulOcr = {
  success: true,
  data: makeOcr(["Take amoxicillin twice daily"]),
  confidence: 95,
  sourceLines: [1],
};

beforeEach(() => {
  vi.resetAllMocks();
  repository.reset();
  resetOcrCache();
});

describe("askGrounded", () => {
  it("passes through a properly grounded document answer", async () => {
    callJsonMock.mockResolvedValueOnce({
      answer: "Take it twice daily.",
      confidence: 95,
      sourceLines: [1],
      source: "document",
    });
    const result = await askGrounded(
      "How often?",
      makeOcr(["Take amoxicillin twice daily"]),
    );
    expect(result).toEqual({
      answer: "Take it twice daily.",
      confidence: 95,
      sourceLines: [1],
      source: "document",
    });
  });

  it('demotes a "document" answer with fabricated line citations to "general" and caps confidence', async () => {
    callJsonMock.mockResolvedValueOnce({
      answer: "Take it twice daily.",
      confidence: 95,
      sourceLines: [99],
      source: "document",
    });
    const result = await askGrounded(
      "How often?",
      makeOcr(["Take amoxicillin twice daily"]),
    );
    expect(result.source).toBe("general");
    expect(result.sourceLines).toEqual([]);
    expect(result.confidence).toBeLessThan(80);
  });

  it('defaults an invalid source to "not-found"', async () => {
    callJsonMock.mockResolvedValueOnce({
      answer: "",
      confidence: 0,
      sourceLines: [],
      source: "bogus",
    });
    const result = await askGrounded("What is X?", makeOcr(["irrelevant"]));
    expect(result.source).toBe("not-found");
  });

  it("caches OCR by file hash so repeat questions skip re-OCR", async () => {
    const documentId = "00000000-0000-4000-8000-000000000099";
    repository.createDocument({
      id: documentId,
      userId: "user-1",
      filename: "instructions.pdf",
      mimeType: "application/pdf",
      fileHash: "ask-hash-123",
      storageKey: "ask-key",
      uploadedAt: new Date().toISOString(),
      status: "ready",
    });
    loadDocumentMock.mockResolvedValue(Buffer.from("pdf-bytes"));
    runOcrMock.mockResolvedValue(successfulOcr);
    callJsonMock.mockResolvedValue({
      answer: "Twice daily.",
      confidence: 90,
      sourceLines: [1],
      source: "document",
    });

    const first = (await askGrounded({
      documentId,
      question: "How often?",
    })) as AskGroundedResult;
    const second = (await askGrounded({
      documentId,
      question: "With food?",
    })) as AskGroundedResult;

    expect(first.answer).toBe("Twice daily.");
    expect(second.answer).toBe("Twice daily.");
    // The OCR cache hit means the second question never re-runs OCR or
    // reloads the stored document.
    expect(runOcrMock).toHaveBeenCalledTimes(1);
    expect(loadDocumentMock).toHaveBeenCalledTimes(1);
  });
});
