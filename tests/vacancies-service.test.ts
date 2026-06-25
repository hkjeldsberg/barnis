// tests/vacancies-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getVacancies } from '../lib/vacancies-service';

const listHtml = `
<h3>Bydel Alna (oppdatert 23. juni 2026)</h3>
<ul><li><a href="https://x/near/">Near barnehage</a>: 2 plasser over 3 år, ledig fra august</li></ul>`;
const detailHtml = `<ods-map :state="{&quot;longitude&quot;:&quot;10.8060&quot;,&quot;latitude&quot;:&quot;59.9420&quot;}"></ods-map>`;

describe('getVacancies', () => {
  it('scrapes list then enriches each entry', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      new Response(url.includes('ledige') ? listHtml : detailHtml, { status: 200 }),
    ) as unknown as typeof fetch;
    const v = await getVacancies({ refresh: true }, fetchFn);
    expect(v).toHaveLength(1);
    expect(v[0].name).toBe('Near barnehage');
    expect(v[0].lat).toBeCloseTo(59.9420, 3);
  });

  it('throws on an upstream non-2xx response instead of caching an empty list', async () => {
    const fetchFn = vi.fn(async () => new Response('Server Error', { status: 502 })) as unknown as typeof fetch;
    await expect(getVacancies({ refresh: true }, fetchFn)).rejects.toThrow(/502/);
  });
});
