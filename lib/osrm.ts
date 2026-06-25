import type { LatLon, CarRoute } from './types';
import { OSRM_URL_BASE } from './config';

export function googleMapsDeepLink(from: LatLon, to: LatLon): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lon}&destination=${to.lat},${to.lon}&travelmode=driving`;
}

export async function getCar(from: LatLon, to: LatLon, fetchFn: typeof fetch = fetch): Promise<CarRoute | null> {
  const url = `${OSRM_URL_BASE}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  let res: Response;
  try { res = await fetchFn(url); } catch { return null; }
  const json = await res.json().catch(() => null);
  if (!json || json.code !== 'Ok' || !json.routes?.[0]) return null;
  const route = json.routes[0];
  const polyline: [number, number][] = (route.geometry?.coordinates ?? []).map((c: [number, number]) => [c[1], c[0]]);
  return {
    durationMin: Math.round(route.duration / 60),
    distanceKm: route.distance / 1000,
    polyline,
  };
}
