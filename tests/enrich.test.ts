import { describe, it, expect, vi } from 'vitest';
import { enrichVacancies } from '../lib/enrich';
import type { Vacancy } from '../lib/types';

const base = (id: string, url: string): Vacancy => ({
  id, name: id, bydel: 'Alna', detailUrl: url, spots: 2, ageGroup: 'over3',
  rawAge: '', availableFrom: 'august', lastUpdated: 'x', description: '',
});

const detailHtml = (lat: string, lon: string) =>
  `<ods-map :state="{&quot;longitude&quot;:&quot;${lon}&quot;,&quot;latitude&quot;:&quot;${lat}&quot;}"></ods-map>
   <dl><dt>Besøksadresse</dt><dd>Somewhere 1, 0500 Oslo</dd></dl>`;

describe('enrichVacancies', () => {
  it('attaches coords, address, distance and sorts by distance', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      const map: Record<string, string> = {
        'https://x/near/': detailHtml('59.9420', '10.8060'),   // ~0.1 km from home
        'https://x/far/': detailHtml('59.9100', '10.7500'),    // several km
      };
      return new Response(map[url] ?? '<div></div>', { status: 200 });
    }) as unknown as typeof fetch;

    const result = await enrichVacancies(
      [base('far', 'https://x/far/'), base('near', 'https://x/near/')],
      fetchFn,
    );
    expect(result[0].id).toBe('near');
    expect(result[0].lat).toBeCloseTo(59.9420, 3);
    expect(result[0].address).toBe('Somewhere 1, 0500 Oslo');
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm!);
  });

  it('keeps a vacancy with null coords, sorted last', async () => {
    const fetchFn = vi.fn(async () => new Response('<div></div>', { status: 200 })) as unknown as typeof fetch;
    const result = await enrichVacancies([base('a', 'https://x/a/')], fetchFn);
    expect(result[0].lat).toBeNull();
    expect(result[0].distanceKm).toBeNull();
  });
});
