import { describe, it, expect, vi } from 'vitest';
import type { OcrResult } from '@discharge/shared-types';

const { callJsonMock } = vi.hoisted(() => ({ callJsonMock: vi.fn() }));
vi.mock('../../src/integrations/openai.js', () => ({ callJson: callJsonMock }));

import { detectAppointments } from '../../src/pipeline/appointmentDetection.js';

function makeOcr(lines: string[]): OcrResult {
  return {
    lines: lines.map((text, idx) => ({ line: idx + 1, text, confidence: 95 })),
    text: lines.join('\n'),
    pageCount: 1,
  };
}

describe('detectAppointments', () => {
  it('returns empty with full confidence when there is no appointment text', async () => {
    const result = await detectAppointments('', makeOcr(['x']));
    expect(result).toEqual({ success: true, data: [], confidence: 100, sourceLines: [] });
    expect(callJsonMock).not.toHaveBeenCalled();
  });

  it('caps confidence when the model cites a nonexistent line number', async () => {
    callJsonMock.mockResolvedValueOnce({
      appointments: [
        { date: null, dateText: 'in 2 weeks', doctor: 'Dr. Lee', specialty: '', location: '', notes: '', sourceLines: [99], confidence: 90 },
      ],
    });
    const result = await detectAppointments('1: Follow up in 2 weeks', makeOcr(['Follow up in 2 weeks']));
    expect(result.data?.[0].sourceLines).toEqual([]);
    expect(result.data?.[0].confidence).toBeLessThanOrEqual(50);
  });

  it('defaults a missing appointments array to empty', async () => {
    callJsonMock.mockResolvedValueOnce({});
    const result = await detectAppointments('1: something', makeOcr(['something']));
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});
