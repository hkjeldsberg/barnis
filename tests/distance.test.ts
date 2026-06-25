import { describe, it, expect } from 'vitest';
import { haversineKm } from '../lib/distance';

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 59.94, lon: 10.8 }, { lat: 59.94, lon: 10.8 })).toBeCloseTo(0, 5);
  });
  it('matches a known Oslo distance (home -> Barneslottet ~ 3.5 km)', () => {
    const d = haversineKm({ lat: 59.9429430, lon: 10.8057210 }, { lat: 59.924773978523, lon: 10.862727820137 });
    expect(d).toBeGreaterThan(3.0);
    expect(d).toBeLessThan(4.5);
  });
});
