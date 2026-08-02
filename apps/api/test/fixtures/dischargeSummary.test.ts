import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import {
  DISCHARGE_SUMMARY_LINES,
  DISCHARGE_SUMMARY_TEXT,
  makeImageOnlyPdf,
  makeTextPdf,
} from "./dischargeSummary.js";

async function readPdf(buffer: Buffer) {
  const document = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(document, { mergePages: true });
  return { text: Array.isArray(text) ? text.join("\n") : String(text ?? ""), totalPages };
}

/** The fixture generator underpins every pipeline test, so it gets its own
 *  tests — a silently malformed PDF here would look like a pipeline bug. */
describe("discharge summary fixture", () => {
  it("produces a PDF that a real parser can read", async () => {
    const pdf = makeTextPdf();
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("%%EOF");

    const parsed = await readPdf(pdf);
    expect(parsed.totalPages).toBeGreaterThanOrEqual(1);
    expect(parsed.text.trim().length).toBeGreaterThan(500);
  });

  it("round-trips every non-empty source line through the text layer", async () => {
    const parsed = await readPdf(makeTextPdf());
    // PDF text extraction rebuilds spacing from glyph positions, so runs of
    // whitespace used for column alignment don't survive verbatim. Compare on
    // collapsed whitespace — that's how the pipeline consumes the text anyway.
    const collapse = (value: string) => value.replace(/\s+/g, " ").trim();
    const haystack = collapse(parsed.text);
    const missing = DISCHARGE_SUMMARY_LINES.map(collapse)
      .filter(Boolean)
      .filter((line) => !haystack.includes(line));
    expect(missing).toEqual([]);
  });

  it("carries the clinical detail the detection stages are tested against", () => {
    expect(DISCHARGE_SUMMARY_TEXT).toContain("Amoxicillin 500 mg");
    expect(DISCHARGE_SUMMARY_TEXT).toContain("Dr. Elena Marsh");
    // A relative follow-up, which must resolve to a null date + dateText.
    expect(DISCHARGE_SUMMARY_TEXT).toContain("in 2 weeks");
    expect(DISCHARGE_SUMMARY_TEXT).toContain("call 911");
  });

  it("can stand in for a scanned document with no usable text layer", async () => {
    const parsed = await readPdf(makeImageOnlyPdf());
    expect(parsed.text.trim().length).toBeLessThan(20);
  });
});
