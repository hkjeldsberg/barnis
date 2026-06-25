import { describe, it, expect, vi } from 'vitest';
import { getTransit } from '../lib/entur';
import polyline from '@mapbox/polyline';

const encoded = polyline.encode([[59.95, 10.78], [59.93, 10.86]]);
const enturResponse = {
  data: { trip: { tripPatterns: [{
    duration: 2580, walkDistance: 1298,
    legs: [
      { mode: 'foot', duration: 360, line: null, pointsOnLink: { points: encoded } },
      { mode: 'bus', duration: 900, line: { publicCode: '23' }, pointsOnLink: { points: encoded } },
    ],
  }] } },
};

describe('getTransit', () => {
  it('maps Entur response to TransitRoute', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(enturResponse), { status: 200 })) as unknown as typeof fetch;
    const r = await getTransit({ lat: 59.95, lon: 10.78 }, { lat: 59.93, lon: 10.86 }, fetchFn);
    expect(r).not.toBeNull();
    expect(r!.durationMin).toBe(43);
    expect(r!.walkDistanceM).toBe(1298);
    expect(r!.legs).toHaveLength(2);
    expect(r!.legs[1]).toEqual({ mode: 'bus', line: '23', durationMin: 15 });
    expect(r!.polyline.length).toBeGreaterThan(0);
    expect(r!.polyline[0][0]).toBeCloseTo(59.95, 2);
  });
  it('returns null when no trip patterns', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: { trip: { tripPatterns: [] } } }), { status: 200 })) as unknown as typeof fetch;
    expect(await getTransit({ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, fetchFn)).toBeNull();
  });
});
