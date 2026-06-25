import polyline from '@mapbox/polyline';
import type { LatLon, TransitRoute, Leg } from './types';
import { ENTUR_URL, CLIENT_NAME } from './config';

interface EnturLeg {
  mode: string;
  duration: number;
  line: { publicCode: string | null } | null;
  pointsOnLink?: { points?: string } | null;
}

function buildQuery(from: LatLon, to: LatLon): string {
  return `{ trip(from:{coordinates:{latitude:${from.lat},longitude:${from.lon}}}, to:{coordinates:{latitude:${to.lat},longitude:${to.lon}}}, numTripPatterns:1){ tripPatterns{ duration walkDistance legs{ mode duration line{ publicCode } pointsOnLink{ points } } } } }`;
}

export function enturDeepLink(from: LatLon, to: LatLon): string {
  return `https://entur.no/nearby-stop-place-detail?` +
    `from=${from.lat},${from.lon}&to=${to.lat},${to.lon}`;
}

export async function getTransit(from: LatLon, to: LatLon, fetchFn: typeof fetch = fetch): Promise<TransitRoute | null> {
  let res: Response;
  try {
    res = await fetchFn(ENTUR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT_NAME },
      body: JSON.stringify({ query: buildQuery(from, to) }),
    });
  } catch { return null; }

  const json = await res.json().catch(() => null);
  const tp = json?.data?.trip?.tripPatterns?.[0];
  if (!tp) return null;

  const legs: Leg[] = (tp.legs as EnturLeg[]).map((l) => ({
    mode: l.mode,
    line: l.line?.publicCode ?? null,
    durationMin: Math.round(l.duration / 60),
  }));

  const polylinePts: [number, number][] = [];
  for (const l of tp.legs as EnturLeg[]) {
    const pts = l.pointsOnLink?.points;
    if (pts) {
      try { polylinePts.push(...(polyline.decode(pts) as [number, number][])); } catch { /* skip */ }
    }
  }

  return {
    durationMin: Math.round(tp.duration / 60),
    walkDistanceM: Math.round(tp.walkDistance),
    legs,
    polyline: polylinePts,
  };
}
