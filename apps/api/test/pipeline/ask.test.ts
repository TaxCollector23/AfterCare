import { describe, it, expect, vi } from 'vitest';
import type { OcrResult } from '@discharge/shared-types';

const { callJsonMock } = vi.hoisted(() => ({ callJsonMock: vi.fn() }));
vi.mock('../../src/integrations/openai.js', () => ({ callJson: callJsonMock }));

import { askGrounded } from '../../src/pipeline/ask.js';

function makeOcr(lines: string[]): OcrResult {
  return {
    lines: lines.map((text, idx) => ({ line: idx + 1, text, confidence: 95 })),
    text: lines.join('\n'),
    pageCount: 1,
  };
}

describe('askGrounded', () => {
  it('passes through a properly grounded document answer', async () => {
    callJsonMock.mockResolvedValueOnce({
      answer: 'Take it twice daily.',
      confidence: 95,
      sourceLines: [1],
      source: 'document',
    });
    const result = await askGrounded('How often?', makeOcr(['Take amoxicillin twice daily']));
    expect(result).toEqual({ answer: 'Take it twice daily.', confidence: 95, sourceLines: [1], source: 'document' });
  });

  it('demotes a "document" answer with fabricated line citations to "general" and caps confidence', async () => {
    callJsonMock.mockResolvedValueOnce({
      answer: 'Take it twice daily.',
      confidence: 95,
      sourceLines: [99],
      source: 'document',
    });
    const result = await askGrounded('How often?', makeOcr(['Take amoxicillin twice daily']));
    expect(result.source).toBe('general');
    expect(result.sourceLines).toEqual([]);
    expect(result.confidence).toBeLessThan(80);
  });

  it('defaults an invalid source to "not-found"', async () => {
    callJsonMock.mockResolvedValueOnce({ answer: '', confidence: 0, sourceLines: [], source: 'bogus' });
    const result = await askGrounded('What is X?', makeOcr(['irrelevant']));
    expect(result.source).toBe('not-found');
  });
});
