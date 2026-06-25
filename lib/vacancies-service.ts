// lib/vacancies-service.ts
import type { EnrichedVacancy } from './types';
import { parseVacancies } from './parse-vacancies';
import { enrichVacancies } from './enrich';
import { TTLCache } from './cache';
import { VACANCIES_URL } from './config';

const cache = new TTLCache<EnrichedVacancy[]>(60 * 60 * 1000); // 1h
const KEY = 'vacancies';

export async function getVacancies(
  opts: { refresh?: boolean } = {},
  fetchFn: typeof fetch = fetch,
): Promise<EnrichedVacancy[]> {
  if (!opts.refresh) {
    const cached = cache.get(KEY);
    if (cached) return cached;
  }
  const res = await fetchFn(VACANCIES_URL, { headers: { 'User-Agent': 'hk-barneplass/1.0' } });
  if (!res.ok) {
    // Surface upstream failure so the route returns 502 and the UI shows its
    // error banner — rather than parsing an error page into an empty list.
    throw new Error(`Vacancies fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  const parsed = parseVacancies(html);
  const enriched = await enrichVacancies(parsed, fetchFn);
  // Don't cache an empty result: a transient upstream blip shouldn't pin an
  // empty list for the full TTL. Keep the previous good data instead.
  if (enriched.length) cache.set(KEY, enriched);
  return enriched;
}
