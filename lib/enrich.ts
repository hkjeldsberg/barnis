import type { Vacancy, EnrichedVacancy } from './types';
import { parseDetail } from './parse-detail';
import { haversineKm } from './distance';
import { HOME } from './config';
import { TTLCache } from './cache';

const detailCache = new TTLCache<{ lat: number | null; lon: number | null; address: string | null }>(24 * 3600 * 1000);

export async function enrichVacancies(vacancies: Vacancy[], fetchFn: typeof fetch = fetch): Promise<EnrichedVacancy[]> {
  const enriched = await Promise.all(
    vacancies.map(async (v): Promise<EnrichedVacancy> => {
      let detail = detailCache.get(v.detailUrl);
      if (!detail) {
        try {
          const res = await fetchFn(v.detailUrl, { headers: { 'User-Agent': 'hk-barneplass/1.0' } });
          const html = await res.text();
          detail = parseDetail(html);
          detailCache.set(v.detailUrl, detail);
        } catch {
          detail = { lat: null, lon: null, address: null };
        }
      }
      const distanceKm =
        detail.lat != null && detail.lon != null
          ? haversineKm(HOME, { lat: detail.lat, lon: detail.lon })
          : null;
      return { ...v, lat: detail.lat, lon: detail.lon, address: detail.address, distanceKm };
    }),
  );

  return enriched.sort((a, b) => {
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}
