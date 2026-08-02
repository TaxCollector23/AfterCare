import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Force the "no text layer" branch regardless of the real PDF's content, so
// this test can exercise real rasterization (pdf-to-img is NOT mocked)
// against a real PDF file without needing an actual scanned document on disk.
vi.mock('pdf-parse/lib/pdf-parse.js', () => ({
  default: vi.fn(async () => ({ text: '', numpages: 5 })),
}));

const { visionTranscribeMock } = vi.hoisted(() => ({ visionTranscribeMock: vi.fn() }));
vi.mock('../../src/integrations/openai.js', () => ({ visionTranscribe: visionTranscribeMock }));

import { runOcr } from '../../src/pipeline/ocr.js';

// A real, valid, 5-page PDF (ships with the pdf-parse package's own test suite).
const REAL_PDF_PATH = path.resolve(
  new URL('.', import.meta.url).pathname,
  '../../../../node_modules/pdf-parse/test/data/02-valid.pdf',
);

describe('runOcr — scanned PDF rasterization (real pdf-to-img, mocked vision)', () => {
  it('rasterizes every real page and transcribes each one through the vision waterfall, in order', async () => {
    const buffer = fs.readFileSync(REAL_PDF_PATH);
    let call = 0;
    visionTranscribeMock.mockImplementation(async (imageBuffer: Buffer, mimeType: string) => {
      call++;
      // Confirm we're actually being handed a real rasterized PNG, not a stub.
      expect(mimeType).toBe('image/png');
      expect(imageBuffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      return `page ${call} text`;
    });

    const result = await runOcr({ buffer, mimeType: 'application/pdf' });

    expect(result.success).toBe(true);
    expect(visionTranscribeMock).toHaveBeenCalledTimes(5);
    expect(result.data?.pageCount).toBe(5);
    // Pages must stay in order despite bounded concurrency.
    expect(result.data?.text).toBe('page 1 text\npage 2 text\npage 3 text\npage 4 text\npage 5 text');
  }, 30_000);

  it('fails cleanly (StageResult, not a crash) when a page transcription fails', async () => {
    const buffer = fs.readFileSync(REAL_PDF_PATH);
    visionTranscribeMock.mockRejectedValue(new Error('all providers down'));

    const result = await runOcr({ buffer, mimeType: 'application/pdf' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/all providers down/);
  }, 30_000);
});
