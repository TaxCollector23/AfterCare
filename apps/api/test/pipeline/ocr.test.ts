import { describe, it, expect, vi } from "vitest";

// Force the "no text layer" branch regardless of the real PDF's content, so
// this test can exercise real rasterization (pdf-to-img is NOT mocked)
// against a real PDF file without needing an actual scanned document on disk.
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({
  default: vi.fn(async () => ({ text: "", numpages: 5 })),
}));

const { visionTranscribeMock } = vi.hoisted(() => ({
  visionTranscribeMock: vi.fn(),
}));
vi.mock("../../src/integrations/openai.js", () => ({
  visionTranscribe: visionTranscribeMock,
}));

import { runOcr } from "../../src/pipeline/ocr.js";

function createEmptyPdf(pageCount: number): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ...Array.from(
      { length: pageCount },
      (_, index) =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] /Resources << >> /Contents ${pageCount + 3 + index} 0 R >>`,
    ),
    ...Array.from(
      { length: pageCount },
      () => "<< /Length 0 >>\nstream\n\nendstream",
    ),
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

const REAL_PDF = createEmptyPdf(5);

describe("runOcr — scanned PDF rasterization (real pdf-to-img, mocked vision)", () => {
  it("rasterizes every real page and transcribes each one through the vision waterfall, in order", async () => {
    const buffer = REAL_PDF;
    let call = 0;
    visionTranscribeMock.mockImplementation(
      async (imageBuffer: Buffer, mimeType: string) => {
        call++;
        // Confirm we're actually being handed a real rasterized PNG, not a stub.
        expect(mimeType).toBe("image/png");
        expect(imageBuffer.subarray(0, 8)).toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
        return `page ${call} text`;
      },
    );

    const result = await runOcr({ buffer, mimeType: "application/pdf" });

    expect(result.success).toBe(true);
    expect(visionTranscribeMock).toHaveBeenCalledTimes(5);
    expect(result.data?.pageCount).toBe(5);
    // Pages must stay in order despite bounded concurrency.
    expect(result.data?.text).toBe(
      "page 1 text\npage 2 text\npage 3 text\npage 4 text\npage 5 text",
    );
  }, 30_000);

  it("fails cleanly (StageResult, not a crash) when a page transcription fails", async () => {
    const buffer = REAL_PDF;
    visionTranscribeMock.mockRejectedValue(new Error("all providers down"));

    const result = await runOcr({ buffer, mimeType: "application/pdf" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/all providers down/);
  }, 30_000);
});
