import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runOcr } from "../../src/pipeline/ocr.js";

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/john-doe-report.pdf",
);

describe("runOcr - text-layer PDF extraction", () => {
  it("extracts the John Doe sample report without vision OCR", async () => {
    const result = await runOcr({
      buffer: readFileSync(FIXTURE_PATH),
      mimeType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(90);
    expect(result.data?.pageCount).toBe(1);
    expect(result.data?.text).toContain("Patient: John Doe");
    expect(result.data?.text).toContain("community-acquired pneumonia");
    expect(result.data?.text).toContain(
      "urgent care for worsening shortness of breath",
    );
  });
});
