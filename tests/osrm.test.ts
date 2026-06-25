import { describe, it, expect, vi } from 'vitest';
import { getCar, googleMapsDeepLink } from '../lib/osrm';

const osrmResponse = {
  code: 'Ok',
  routes: [{ duration: 647.7, distance: 8508.4, geometry: { coordinates: [[10.78, 59.95], [10.86, 59.93]] } }],
};

describe('getCar', () => {
  it('maps OSRM response to CarRoute with [lat,lon] polyline', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(osrmResponse), { status: 200 })) as unknown as typeof fetch;
    const r = await getCar({ lat: 59.95, lon: 10.78 }, { lat: 59.93, lon: 10.86 }, fetchFn);
    expect(r).not.toBeNull();
    expect(r!.durationMin).toBe(11);
    expect(r!.distanceKm).toBeCloseTo(8.5, 1);
    expect(r!.polyline[0]).toEqual([59.95, 10.78]); // flipped from [lon,lat]
  });
  it('returns null when code != Ok', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ code: 'NoRoute' }), { status: 200 })) as unknown as typeof fetch;
    expect(await getCar({ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, fetchFn)).toBeNull();
  });
  it('builds a google maps deep link', () => {
    expect(googleMapsDeepLink({ lat: 59.95, lon: 10.78 }, { lat: 59.93, lon: 10.86 }))
      .toBe('https://www.google.com/maps/dir/?api=1&origin=59.95,10.78&destination=59.93,10.86&travelmode=driving');
  });
});
