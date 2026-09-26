import { describe, it, expect } from 'vitest';
import { parseVacancies, parseAgeGroup } from '../lib/parse-vacancies';

const HTML = `
<h3>Bydel Alna (oppdatert 23. juni 2026)</h3>
<ul>
  <li><a href="https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/barneslottet-barnehage/">Barneslottet barnehage</a>: 2 plasser over 3 år, ledig fra august</li>
  <li><a href="https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/gransbakken-barnehage/">Gransbakken barnehage</a>: 2plasser over 3 år, ledig fra august.</li>
</ul>
<h3>Bydel Bjerke (oppdatert 19. mai 2026)</h3>
<p>Ingen ledige plasser</p>
<h3>Bydel Gamle Oslo (oppdatert 22. juni 2026)</h3>
<ul>
  <li><a href="https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/borggata-familiebarnehage/">Borggata familiebarnehage</a>: 2 ledige plasser for barn under 3 år, ledig fra august</li>
</ul>
<h3>Bydel Grønerløkka (oppdatert 18. juni 2026)</h3>
<ul>
  <li><a href="https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/gaia-barnehage/">Gaia barnehage</a>: 1 ledig plass til barn født i 2024 fra august.</li>
</ul>`;

describe('parseVacancies', () => {
  it('parses all listed kindergartens, skips "Ingen ledige plasser"', () => {
    const v = parseVacancies(HTML);
    expect(v).toHaveLength(4);
  });
  it('extracts fields for the first entry', () => {
    const v = parseVacancies(HTML)[0];
    expect(v.name).toBe('Barneslottet barnehage');
    expect(v.bydel).toBe('Alna');
    expect(v.id).toBe('barneslottet-barnehage');
    expect(v.spots).toBe(2);
    expect(v.ageGroup).toBe('over3');
    expect(v.availableFrom).toBe('august');
    expect(v.lastUpdated).toBe('23. juni 2026');
    expect(v.detailUrl).toContain('barneslottet-barnehage');
  });
  it('handles missing space "2plasser"', () => {
    const v = parseVacancies(HTML).find(x => x.id === 'gransbakken-barnehage')!;
    expect(v.spots).toBe(2);
  });
  it('detects under3 age group and parses birth-year entries', () => {
    const borggata = parseVacancies(HTML).find(x => x.id === 'borggata-familiebarnehage')!;
    expect(borggata.ageGroup).toBe('under3');
    const gaia = parseVacancies(HTML).find(x => x.id === 'gaia-barnehage')!;
    expect(gaia.spots).toBe(1);
    expect(gaia.rawAge).toContain('født i 2024');
  });
  it('strips a trailing colon when the ":" sits inside the <a> tag', () => {
    const html = `
<h3>Bydel Grünerløkka (oppdatert 18. juni 2026)</h3>
<ul><li><a href="https://x/finn-barnehage-i-oslo/waldemars-barnehage/">Læringsverkstedet Waldemars barnehage:</a> 1 ledig plass for barn født 2021–2023</li></ul>`;
    const v = parseVacancies(html)[0];
    expect(v.name).toBe('Læringsverkstedet Waldemars barnehage');
    expect(v.spots).toBe(1);
  });
});

describe('parseAgeGroup', () => {
  const now = new Date('2026-09-26');
  it('classifies explicit under/over 3', () => {
    expect(parseAgeGroup('2 ledige plasser for barn under 3 år', now)).toBe('under3');
    expect(parseAgeGroup('2 plasser over 3 år, ledig fra september', now)).toBe('over3');
  });
  it('classifies age ranges by bounds', () => {
    expect(parseAgeGroup('1 plass for barn 3–6 år, ledig fra september', now)).toBe('over3');
    expect(parseAgeGroup('1 ledig plass for barn 3-5 år', now)).toBe('over3');
    expect(parseAgeGroup('1 plass for barn 1–2 år', now)).toBe('under3');
    expect(parseAgeGroup('2 plasser for barn 1–5 år', now)).toBe('mixed');
  });
  it('classifies birth year by barnehage year (small until July of year turning 3)', () => {
    expect(parseAgeGroup('1 plass for barn født 2024', now)).toBe('under3');
    expect(parseAgeGroup('1 plass for barn født i 2022', now)).toBe('over3');
    expect(parseAgeGroup('1 plass for barn født 2023', now)).toBe('over3');
    expect(parseAgeGroup('1 plass for barn født 2023', new Date('2026-05-01'))).toBe('under3');
  });
  it('classifies birth-year ranges by both ends', () => {
    expect(parseAgeGroup('1 ledig plass for barn født 2021–2023', now)).toBe('over3');
    expect(parseAgeGroup('1 ledig plass for barn født 2022–2024', now)).toBe('mixed');
  });
  it('multiple distinct groups → mixed', () => {
    expect(parseAgeGroup('1 plass for barn 3–6 år, og 1 plass for barn født 2024, ledig fra september', now)).toBe('mixed');
  });
  it('no age info → unknown', () => {
    expect(parseAgeGroup('1 ledig plass', now)).toBe('unknown');
  });
});
