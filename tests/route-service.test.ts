// tests/route-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getRoute } from '../lib/route-service';

describe('getRoute', () => {
  it('combines transit + car and includes deep links', async () => {
    const enturResp = { data: { trip: { tripPatterns: [{ duration: 1800, walkDistance: 500, legs: [{ mode: 'bus', duration: 1800, line: { publicCode: '31' }, pointsOnLink: { points: '' } }] }] } } };
    const osrmResp = { code: 'Ok', routes: [{ duration: 600, distance: 5000, geometry: { coordinates: [[10.8, 59.94], [10.86, 59.92]] } }] };
    const fetchFn = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes('entur') ? enturResp : osrmResp), { status: 200 }),
    ) as unknown as typeof fetch;

    const r = await getRoute({ lat: 59.92, lon: 10.86 }, { lat: 59.9429430, lon: 10.8057210 }, fetchFn);
    expect(r.transit!.durationMin).toBe(30);
    expect(r.car!.durationMin).toBe(10);
    expect(r.enturUrl).toContain('entur.no');
    expect(r.googleMapsUrl).toContain('google.com/maps');
  });
});
