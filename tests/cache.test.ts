import { describe, it, expect } from 'vitest';
import { TTLCache } from '../lib/cache';

describe('TTLCache', () => {
  it('returns stored value before expiry', () => {
    let t = 1000;
    const c = new TTLCache<number>(5000, () => t);
    c.set('a', 42);
    t = 4000;
    expect(c.get('a')).toBe(42);
  });
  it('expires value after ttl', () => {
    let t = 1000;
    const c = new TTLCache<number>(5000, () => t);
    c.set('a', 42);
    t = 7000;
    expect(c.get('a')).toBeUndefined();
  });
});
