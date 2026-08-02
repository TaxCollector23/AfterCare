import { describe, it, expect, vi } from 'vitest';
import type { OcrResult } from '@discharge/shared-types';

const { callJsonMock } = vi.hoisted(() => ({ callJsonMock: vi.fn() }));
vi.mock('../../src/integrations/openai.js', () => ({ callJson: callJsonMock }));

import { detectWarnings } from '../../src/pipeline/warningDetection.js';

function makeOcr(lines: string[]): OcrResult {
  return {
    lines: lines.map((text, idx) => ({ line: idx + 1, text, confidence: 95 })),
    text: lines.join('\n'),
    pageCount: 1,
  };
}

describe('detectWarnings', () => {
  it('returns empty with full confidence when there is no warning text', async () => {
    const result = await detectWarnings('', makeOcr(['x']));
    expect(result).toEqual({ success: true, data: [], confidence: 100, sourceLines: [] });
  });

  it('defaults an invalid/missing severity to the cautious "emergency" option', async () => {
    callJsonMock.mockResolvedValueOnce({
      warnings: [{ symptom: 'fever over 101', action: '', sourceLines: [1], confidence: 90 }],
    });
    const result = await detectWarnings('1: fever over 101', makeOcr(['fever over 101']));
    expect(result.data?.[0].severity).toBe('emergency');
  });

  it('caps confidence when the model cites a nonexistent line number', async () => {
    callJsonMock.mockResolvedValueOnce({
      warnings: [{ symptom: 'chest pain', action: 'go to ER', severity: 'emergency', sourceLines: [99], confidence: 95 }],
    });
    const result = await detectWarnings('1: chest pain', makeOcr(['chest pain']));
    expect(result.data?.[0].sourceLines).toEqual([]);
    expect(result.data?.[0].confidence).toBeLessThanOrEqual(50);
  });
});
