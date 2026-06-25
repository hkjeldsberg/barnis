// lib/route-service.ts
import type { LatLon, RouteResult } from './types';
import { getTransit, enturDeepLink } from './entur';
import { getCar, googleMapsDeepLink } from './osrm';
import { HOME } from './config';

export async function getRoute(to: LatLon, from: LatLon = HOME, fetchFn: typeof fetch = fetch): Promise<RouteResult> {
  const [transit, car] = await Promise.all([
    getTransit(from, to, fetchFn),
    getCar(from, to, fetchFn),
  ]);
  return {
    transit,
    car,
    enturUrl: enturDeepLink(from, to),
    googleMapsUrl: googleMapsDeepLink(from, to),
  };
}
