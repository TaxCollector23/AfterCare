import { describe, expect, it, vi } from "vitest";
import { makeTextPdf } from "../fixtures/dischargeSummary.js";

// Deliberately no `unpdf` mock here: the whole point is to exercise the real
// PDF text extractor against two different documents in one process.
vi.mock("../../src/integrations/openai.js", () => ({
  visionTranscribe: vi.fn(),
}));

import { runOcr } from "../../src/pipeline/ocr.js";

/**
 * Regression guard for a defect that reached production.
 *
 * `pdf-parse` bundles pdf.js v1.10.100, which keeps document state in module
 * globals: the second and every later parse in the same process returned the
 * FIRST document's text. In a long-lived API that means one patient being shown
 * another patient's medications. Any PDF text extractor used here must isolate
 * each call.
 */
describe("runOcr - document isolation", () => {
  it("never returns a previous document's text on a later read", async () => {
    const first = await runOcr({
      buffer: makeTextPdf(),
      mimeType: "application/pdf",
    });
    const second = await runOcr({
      buffer: makeTextPdf(["Patient B: Ibuprofen 200 mg once daily"]),
      mimeType: "application/pdf",
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.data?.text).toContain("BAYVIEW GENERAL HOSPITAL");
    expect(second.data?.text).toContain("Ibuprofen 200 mg");
    expect(second.data?.text).not.toContain("BAYVIEW GENERAL HOSPITAL");
    expect(second.data?.text).not.toContain("Oxycodone");
  });

  it("reads a real text layer without any vision call", async () => {
    const result = await runOcr({
      buffer: makeTextPdf(),
      mimeType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.data?.text).toContain("Amoxicillin 500 mg");
    expect(result.data?.lines[0]?.line).toBe(1);
  });
});
