export interface LatLon { lat: number; lon: number; }
export type AgeGroup = 'under3' | 'over3' | 'mixed' | 'unknown';

export interface Vacancy {
  id: string;            // slug from detail url, e.g. "barneslottet-barnehage"
  name: string;
  bydel: string;
  detailUrl: string;
  spots: number | null;
  ageGroup: AgeGroup;
  rawAge: string;        // e.g. "over 3 år", "født i 2024"
  availableFrom: string; // e.g. "august"
  lastUpdated: string;   // bydel update date text
  description: string;   // full text after the ":"
}

export interface EnrichedVacancy extends Vacancy {
  lat: number | null;
  lon: number | null;
  address: string | null;
  distanceKm: number | null;
}

export interface Leg { mode: string; line: string | null; durationMin: number; }
export interface TransitRoute { durationMin: number; walkDistanceM: number; legs: Leg[]; polyline: [number, number][]; }
export interface CarRoute { durationMin: number; distanceKm: number; polyline: [number, number][]; }
export interface RouteResult { transit: TransitRoute | null; car: CarRoute | null; enturUrl: string; googleMapsUrl: string; }
