import { describe, it, expect, vi } from 'vitest';
import type { OcrResult } from '@discharge/shared-types';

const { callJsonMock } = vi.hoisted(() => ({ callJsonMock: vi.fn() }));
vi.mock('../../src/integrations/openai.js', () => ({ callJson: callJsonMock }));

import { detectMedications } from '../../src/pipeline/medicationDetection.js';

function makeOcr(lines: string[]): OcrResult {
  return {
    lines: lines.map((text, idx) => ({ line: idx + 1, text, confidence: 95 })),
    text: lines.join('\n'),
    pageCount: 1,
  };
}

describe('detectMedications', () => {
  it('returns empty with full confidence when there is no medication text', async () => {
    const result = await detectMedications('', makeOcr(['x']));
    expect(result).toEqual({ success: true, data: [], confidence: 100, sourceLines: [] });
    expect(callJsonMock).not.toHaveBeenCalled();
  });

  it('caps confidence when the model cites a nonexistent line number', async () => {
    callJsonMock.mockResolvedValueOnce({
      medications: [
        { name: 'Amoxicillin', dose: '500mg', frequency: 'twice daily', timing: '', instructions: '', sourceLines: [99], confidence: 95 },
      ],
    });
    const result = await detectMedications('1: Amoxicillin 500mg', makeOcr(['Amoxicillin 500mg']));
    expect(result.data?.[0].sourceLines).toEqual([]);
    expect(result.data?.[0].confidence).toBeLessThanOrEqual(50);
  });

  it('defaults missing string fields and drops a missing medications array', async () => {
    callJsonMock.mockResolvedValueOnce({});
    const result = await detectMedications('1: something', makeOcr(['something']));
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});
