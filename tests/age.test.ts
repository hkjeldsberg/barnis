import { describe, it, expect } from 'vitest';
import { matchesAge } from '../lib/age';

describe('matchesAge', () => {
  it('age 2 matches under3 and mixed/unknown, not over3', () => {
    expect(matchesAge('under3', 2)).toBe(true);
    expect(matchesAge('mixed', 2)).toBe(true);
    expect(matchesAge('unknown', 2)).toBe(true);
    expect(matchesAge('over3', 2)).toBe(false);
  });
  it('age 4 matches over3 and mixed/unknown, not under3', () => {
    expect(matchesAge('over3', 4)).toBe(true);
    expect(matchesAge('mixed', 4)).toBe(true);
    expect(matchesAge('unknown', 4)).toBe(true);
    expect(matchesAge('under3', 4)).toBe(false);
  });
  it('age 3 is treated as over3 boundary', () => {
    expect(matchesAge('over3', 3)).toBe(true);
    expect(matchesAge('under3', 3)).toBe(false);
  });
});
