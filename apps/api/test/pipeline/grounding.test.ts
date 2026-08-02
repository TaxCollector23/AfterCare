import { describe, it, expect } from 'vitest';
import { isGrounded, resolveSourceLines } from '../../src/pipeline/grounding.js';

const lines = [
  { line: 1, text: 'Take amoxicillin', confidence: 95 },
  { line: 2, text: 'twice daily', confidence: 95 },
];

describe('isGrounded', () => {
  it('is false for empty sourceLines', () => {
    expect(isGrounded(lines, [])).toBe(false);
  });
  it('is false when no cited line exists', () => {
    expect(isGrounded(lines, [99])).toBe(false);
  });
  it('is true when at least one cited line exists', () => {
    expect(isGrounded(lines, [2, 99])).toBe(true);
  });
});

describe('resolveSourceLines', () => {
  it('joins resolved lines and drops nonexistent ones', () => {
    expect(resolveSourceLines(lines, [1, 99])).toBe('1: Take amoxicillin');
  });
});
