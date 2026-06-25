# Barneplass Oslo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js web app that scrapes available kindergarten spots in Oslo, lists and maps them, shows straight-line distance from a fixed home address, and shows transit + car routes per kindergarten.

**Architecture:** Next.js App Router (TypeScript). Server-side API routes do all external calls (scrape `oslo.kommune.no`, enrich coordinates from kindergarten detail pages, Entur transit, OSRM car). The client renders a Leaflet map + filterable list. In-memory TTL cache on the server.

**Tech Stack:** Next.js, React, TypeScript, Vitest, cheerio (HTML parsing), react-leaflet + leaflet (map), @mapbox/polyline (decode Entur geometry), OpenStreetMap tiles. No API keys.

## Global Constraints

- Next.js App Router + TypeScript. Node 18+ global `fetch` (no node-fetch).
- No API keys anywhere. Entur requires header `ET-Client-Name: hk-barneplass`. Nominatim/OSM calls send `User-Agent: hk-barneplass/1.0`.
- Home address: `Traverveien 14, 0588 Oslo`, coords `lat 59.9429430, lon 10.8057210` (hardcoded in `lib/config.ts`).
- Defaults: child age **2**, show **10**, max shown = total matched.
- Entur endpoint: `https://api.entur.io/journey-planner/v3/graphql`.
- OSRM endpoint: `https://router.project-osrm.org/route/v1/driving/{lon},{lat};{lon},{lat}?overview=full&geometries=geojson`.
- Vacancies source: `https://www.oslo.kommune.no/barnehage/ledige-barnehageplasser/`. Detail pages: the `href` on each `<li>` (absolute URL).
- All polylines are stored as `[lat, lon][]` (Leaflet order).
- Test command: `npx vitest run <file> -t "<name>"`.

---

## Source data shapes (verified 2026-06-25)

**Vacancies page** — server-rendered HTML:
```html
<h3>Bydel Alna (oppdatert 23. juni 2026)</h3>
<ul>
  <li><a href="https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/barneslottet-barnehage/">Barneslottet barnehage</a>: 2 plasser over 3 år, ledig fra august</li>
  <li><a href="...gransbakken-barnehage/">Gransbakken barnehage</a>: 2plasser over 3 år, ledig fra august.</li>
</ul>
<h3>Bydel Bjerke (oppdatert 19. mai 2026)</h3>
<p>Ingen ledige plasser</p>
<h3>Bydel Gamle Oslo (oppdatert 22. juni 2026)</h3>
<ul>
  <li><a href="...borggata-familiebarnehage/">Borggata familiebarnehage</a>: 2 ledige plasser for barn under 3 år, ledig fra august</li>
</ul>
<h3>Bydel Grønerløkka (oppdatert 18. juni 2026)</h3>
<ul>
  <li><a href="...gaia-barnehage/">Gaia barnehage</a>: 1 ledig plass til barn født i 2024 fra august.</li>
</ul>
```
Variations to tolerate: `2plasser` (no space), `plasser or barn 3–6 år` (typo), `1 plass`, `6 ledige plasser`, trailing periods, `født i YYYY`.

**Detail page** — coordinates in an `ods-map` web component (HTML-entity-encoded JSON) and address in a definition list:
```html
:state="{&quot;zoom&quot;:15,&quot;longitude&quot;:&quot;10.862727820137&quot;,&quot;latitude&quot;:&quot;59.924773978523&quot;}"
...
<dt class="ods-contactbox__label">Besøksadresse</dt>
<dd class="ods-contactbox__value"> Dr. Dedichens vei 18, 0675 Oslo </dd>
```

**Entur** trip query returns `tripPatterns[].{duration,walkDistance,legs[].{mode,duration,line.publicCode,pointsOnLink.points,fromPlace,toPlace}}`. `pointsOnLink.points` is an encoded polyline (precision 5).

**OSRM** returns `routes[0].{duration,distance,geometry.coordinates}` where coordinates are `[lon,lat]`.

---

### Task 1: Project scaffold + test runner

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `app/layout.tsx`, `app/globals.css`, `lib/sanity.ts`, `tests/sanity.test.ts`

**Interfaces:**
- Produces: a runnable Next.js app + working Vitest. `add(a:number,b:number):number` in `lib/sanity.ts` (smoke only; deleted in Task 3 commit if desired, otherwise harmless).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "barneplass-oslo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "cheerio": "1.0.0",
    "leaflet": "1.9.4",
    "react-leaflet": "4.2.1",
    "@mapbox/polyline": "1.2.1"
  },
  "devDependencies": {
    "typescript": "5.5.4",
    "@types/node": "20.14.0",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "@types/leaflet": "1.9.12",
    "@types/mapbox__polyline": "1.0.5",
    "vitest": "2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.mjs` and `vitest.config.ts`**

```js
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 4: Create minimal app shell**

```tsx
// app/layout.tsx
import './globals.css';
export const metadata = { title: 'Barneplass Oslo', description: 'Ledige barnehageplasser i Oslo' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
```

```css
/* app/globals.css */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
```

- [ ] **Step 5: Write the sanity test**

```ts
// lib/sanity.ts
export function add(a: number, b: number): number { return a + b; }
```
```ts
// tests/sanity.test.ts
import { describe, it, expect } from 'vitest';
import { add } from '../lib/sanity';
describe('sanity', () => { it('adds', () => { expect(add(2, 3)).toBe(5); }); });
```

- [ ] **Step 6: Install + run test**

Run: `npm install && npx vitest run tests/sanity.test.ts`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with vitest"
```

---

### Task 2: Shared types + config

**Files:**
- Create: `lib/types.ts`, `lib/config.ts`, `tests/config.test.ts`

**Interfaces:**
- Produces: types `AgeGroup`, `Vacancy`, `EnrichedVacancy`, `Leg`, `TransitRoute`, `CarRoute`, `RouteResult`, `LatLon`; constant `HOME: { lat:number; lon:number; label:string }`; constants `ENTUR_URL`, `OSRM_URL_BASE`, `VACANCIES_URL`, `CLIENT_NAME`.

- [ ] **Step 1: Write `lib/types.ts`**

```ts
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
```

- [ ] **Step 2: Write `lib/config.ts`**

```ts
export const HOME = { lat: 59.9429430, lon: 10.8057210, label: 'Traverveien 14, 0588 Oslo' };
export const VACANCIES_URL = 'https://www.oslo.kommune.no/barnehage/ledige-barnehageplasser/';
export const ENTUR_URL = 'https://api.entur.io/journey-planner/v3/graphql';
export const OSRM_URL_BASE = 'https://router.project-osrm.org/route/v1/driving';
export const CLIENT_NAME = 'hk-barneplass';
```

- [ ] **Step 3: Write the test**

```ts
// tests/config.test.ts
import { describe, it, expect } from 'vitest';
import { HOME } from '../lib/config';
describe('config', () => {
  it('home coords are in Oslo bounds', () => {
    expect(HOME.lat).toBeGreaterThan(59.8); expect(HOME.lat).toBeLessThan(60.1);
    expect(HOME.lon).toBeGreaterThan(10.5); expect(HOME.lon).toBeLessThan(11.1);
  });
});
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/config.ts tests/config.test.ts
git commit -m "feat: shared types and config constants"
```

---

### Task 3: Vacancy parser

**Files:**
- Create: `lib/parse-vacancies.ts`, `tests/parse-vacancies.test.ts`

**Interfaces:**
- Consumes: `Vacancy`, `AgeGroup` from `lib/types`.
- Produces: `parseVacancies(html: string): Vacancy[]`; `slugFromUrl(url: string): string`; `parseAgeGroup(text: string): AgeGroup`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/parse-vacancies.test.ts
import { describe, it, expect } from 'vitest';
import { parseVacancies } from '../lib/parse-vacancies';

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
  it('detects under3 and birth-year (mixed) age groups', () => {
    const borggata = parseVacancies(HTML).find(x => x.id === 'borggata-familiebarnehage')!;
    expect(borggata.ageGroup).toBe('under3');
    const gaia = parseVacancies(HTML).find(x => x.id === 'gaia-barnehage')!;
    expect(gaia.spots).toBe(1);
    expect(gaia.ageGroup).toBe('mixed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parse-vacancies.test.ts`
Expected: FAIL — cannot find module `../lib/parse-vacancies`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/parse-vacancies.ts
import * as cheerio from 'cheerio';
import type { Vacancy, AgeGroup } from './types';

export function slugFromUrl(url: string): string {
  const parts = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : url;
}

export function parseAgeGroup(text: string): AgeGroup {
  const t = text.toLowerCase();
  if (/under\s*3/.test(t)) return 'under3';
  if (/\d\s*[–-]\s*\d/.test(t) || /født/.test(t)) return 'mixed';
  if (/over\s*3/.test(t)) return 'over3';
  return 'unknown';
}

function parseSpots(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:ledige?\s+)?plass/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseAvailableFrom(text: string): string {
  const m = text.match(/(?:ledig\s+)?fra\s+([a-zæøå]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function buildVacancy(name: string, detailUrl: string, bydel: string, lastUpdated: string, description: string): Vacancy {
  return {
    id: slugFromUrl(detailUrl),
    name,
    bydel,
    detailUrl,
    spots: parseSpots(description),
    ageGroup: parseAgeGroup(description),
    rawAge: description,
    availableFrom: parseAvailableFrom(description),
    lastUpdated,
    description,
  };
}

export function parseVacancies(html: string): Vacancy[] {
  const $ = cheerio.load(html);
  const out: Vacancy[] = [];
  $('h3').each((_, h3) => {
    const heading = $(h3).text().trim();
    const m = heading.match(/^Bydel\s+(.+?)\s*\(oppdatert\s+(.+?)\)\s*$/i);
    if (!m) return;
    const bydel = m[1].trim();
    const lastUpdated = m[2].trim();
    let el = $(h3).next();
    while (el.length && el.prop('tagName') !== 'H3') {
      if (el.prop('tagName') === 'UL') {
        el.find('li').each((__, li) => {
          const a = $(li).find('a').first();
          const name = a.text().trim();
          const detailUrl = a.attr('href') || '';
          if (!name || !detailUrl) return;
          const full = $(li).text().trim();
          const idx = full.indexOf(':');
          const description = idx >= 0 ? full.slice(idx + 1).trim() : full;
          out.push(buildVacancy(name, detailUrl, bydel, lastUpdated, description));
        });
      }
      el = el.next();
    }
  });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parse-vacancies.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/parse-vacancies.ts tests/parse-vacancies.test.ts
git commit -m "feat: parse Oslo kommune vacancy listings"
```

---

### Task 4: Age matching

**Files:**
- Create: `lib/age.ts`, `tests/age.test.ts`

**Interfaces:**
- Consumes: `AgeGroup` from `lib/types`.
- Produces: `matchesAge(group: AgeGroup, ageYears: number): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/age.test.ts
import { describe, it, expect } from 'vitest';
import { matchesAge } from '../lib/age';

describe('matchesAge', () => {
  it('age 2 matches under3 and mixed/unknown, not over3', () => {
    expect(matchesAge('under3', 2)).toBe(true);
    expect(matchesAge('mixed', 2)).toBe(true);
    expect(matchesAge('unknown', 2)).toBe(true);
    expect(matchesAge('over3', 2)).toBe(false);
  });
  it('age 4 matches over3 and mixed/unknown, not under3', () => {
    expect(matchesAge('over3', 4)).toBe(true);
    expect(matchesAge('mixed', 4)).toBe(true);
    expect(matchesAge('unknown', 4)).toBe(true);
    expect(matchesAge('under3', 4)).toBe(false);
  });
  it('age 3 is treated as over3 boundary', () => {
    expect(matchesAge('over3', 3)).toBe(true);
    expect(matchesAge('under3', 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/age.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/age.ts
import type { AgeGroup } from './types';

// Vacancies with mixed/unknown age info are always shown (never hide an option).
export function matchesAge(group: AgeGroup, ageYears: number): boolean {
  if (group === 'mixed' || group === 'unknown') return true;
  if (ageYears < 3) return group === 'under3';
  return group === 'over3';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/age.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/age.ts tests/age.test.ts
git commit -m "feat: age-group matching for vacancy filtering"
```

---

### Task 5: Distance (haversine)

**Files:**
- Create: `lib/distance.ts`, `tests/distance.test.ts`

**Interfaces:**
- Consumes: `LatLon` from `lib/types`.
- Produces: `haversineKm(a: LatLon, b: LatLon): number`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/distance.test.ts
import { describe, it, expect } from 'vitest';
import { haversineKm } from '../lib/distance';

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 59.94, lon: 10.8 }, { lat: 59.94, lon: 10.8 })).toBeCloseTo(0, 5);
  });
  it('matches a known Oslo distance (home -> Barneslottet ~ 3.5 km)', () => {
    const d = haversineKm({ lat: 59.9429430, lon: 10.8057210 }, { lat: 59.924773978523, lon: 10.862727820137 });
    expect(d).toBeGreaterThan(3.0);
    expect(d).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/distance.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/distance.ts
import type { LatLon } from './types';

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/distance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/distance.ts tests/distance.test.ts
git commit -m "feat: haversine distance helper"
```

---

### Task 6: Detail-page parser (coordinates + address)

**Files:**
- Create: `lib/parse-detail.ts`, `tests/parse-detail.test.ts`

**Interfaces:**
- Produces: `parseDetail(html: string): { lat: number | null; lon: number | null; address: string | null }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/parse-detail.test.ts
import { describe, it, expect } from 'vitest';
import { parseDetail } from '../lib/parse-detail';

const HTML = `
<div>
  <ods-map ratio="ods-ratio-1-1 mapboxgl-map"
    :state="{&quot;zoom&quot;:15,&quot;longitude&quot;:&quot;10.862727820137&quot;,&quot;latitude&quot;:&quot;59.924773978523&quot;}"
    :points="[{&quot;longitude&quot;:&quot;10.862727820137&quot;,&quot;latitude&quot;:&quot;59.924773978523&quot;,&quot;openPopup&quot;:true}]">
  </ods-map>
  <dl class="ods-contactbox__group">
    <dt class="ods-contactbox__label">Besøksadresse</dt>
    <dd class="ods-contactbox__value"> Dr. Dedichens vei 18, 0675 Oslo </dd>
  </dl>
</div>`;

describe('parseDetail', () => {
  it('extracts coordinates', () => {
    const d = parseDetail(HTML);
    expect(d.lat).toBeCloseTo(59.924773978523, 6);
    expect(d.lon).toBeCloseTo(10.862727820137, 6);
  });
  it('extracts visiting address', () => {
    expect(parseDetail(HTML).address).toBe('Dr. Dedichens vei 18, 0675 Oslo');
  });
  it('returns nulls when data is absent', () => {
    const d = parseDetail('<div>nothing here</div>');
    expect(d.lat).toBeNull(); expect(d.lon).toBeNull(); expect(d.address).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parse-detail.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/parse-detail.ts
import * as cheerio from 'cheerio';

export function parseDetail(html: string): { lat: number | null; lon: number | null; address: string | null } {
  const decoded = html.replace(/&quot;/g, '"');
  const latM = decoded.match(/"latitude":\s*"?(-?\d+(?:\.\d+)?)"?/);
  const lonM = decoded.match(/"longitude":\s*"?(-?\d+(?:\.\d+)?)"?/);

  const $ = cheerio.load(html);
  let address: string | null = null;
  $('dt').each((_, dt) => {
    if (address) return;
    if (/adresse/i.test($(dt).text())) {
      const dd = $(dt).next('dd');
      if (dd.length) address = dd.text().trim().replace(/\s+/g, ' ');
    }
  });

  return {
    lat: latM ? parseFloat(latM[1]) : null,
    lon: lonM ? parseFloat(lonM[1]) : null,
    address,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parse-detail.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/parse-detail.ts tests/parse-detail.test.ts
git commit -m "feat: parse coordinates and address from detail pages"
```

---

### Task 7: TTL cache utility

**Files:**
- Create: `lib/cache.ts`, `tests/cache.test.ts`

**Interfaces:**
- Produces: `class TTLCache<T>` with `get(key:string): T | undefined`, `set(key:string, value:T): void`, constructor `(ttlMs:number, now?: () => number)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cache.test.ts
import { describe, it, expect } from 'vitest';
import { TTLCache } from '../lib/cache';

describe('TTLCache', () => {
  it('returns stored value before expiry', () => {
    let t = 1000;
    const c = new TTLCache<number>(5000, () => t);
    c.set('a', 42);
    t = 4000;
    expect(c.get('a')).toBe(42);
  });
  it('expires value after ttl', () => {
    let t = 1000;
    const c = new TTLCache<number>(5000, () => t);
    c.set('a', 42);
    t = 7000;
    expect(c.get('a')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/cache.ts
export class TTLCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  constructor(private ttlMs: number, private now: () => number = () => Date.now()) {}
  get(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (this.now() > e.expires) { this.store.delete(key); return undefined; }
    return e.value;
  }
  set(key: string, value: T): void {
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/cache.ts tests/cache.test.ts
git commit -m "feat: in-memory TTL cache"
```

---

### Task 8: Enrichment (fetch detail pages → coords/address/distance)

**Files:**
- Create: `lib/enrich.ts`, `tests/enrich.test.ts`

**Interfaces:**
- Consumes: `Vacancy`, `EnrichedVacancy` from `lib/types`; `parseDetail`; `haversineKm`; `HOME`; `TTLCache`.
- Produces: `enrichVacancies(vacancies: Vacancy[], fetchFn?: typeof fetch): Promise<EnrichedVacancy[]>` (sorted ascending by `distanceKm`, nulls last).

- [ ] **Step 1: Write the failing test**

```ts
// tests/enrich.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/enrich.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/enrich.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/enrich.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/enrich.ts tests/enrich.test.ts
git commit -m "feat: enrich vacancies with coords, address, distance"
```

---

### Task 9: `/api/vacancies` route

**Files:**
- Create: `lib/vacancies-service.ts`, `app/api/vacancies/route.ts`, `tests/vacancies-service.test.ts`

**Interfaces:**
- Consumes: `parseVacancies`, `enrichVacancies`, `TTLCache`, `VACANCIES_URL`.
- Produces: `getVacancies(opts?: { refresh?: boolean }, fetchFn?: typeof fetch): Promise<EnrichedVacancy[]>`; route `GET` returning `{ vacancies, fetchedAt }`.

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/vacancies-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
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
  const html = await res.text();
  const parsed = parseVacancies(html);
  const enriched = await enrichVacancies(parsed, fetchFn);
  cache.set(KEY, enriched);
  return enriched;
}
```

```ts
// app/api/vacancies/route.ts
import { NextResponse } from 'next/server';
import { getVacancies } from '@/lib/vacancies-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get('refresh') === '1';
  try {
    const vacancies = await getVacancies({ refresh });
    return NextResponse.json({ vacancies, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: 'Kunne ikke hente ledige plasser', detail: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/vacancies-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/vacancies-service.ts app/api/vacancies/route.ts tests/vacancies-service.test.ts
git commit -m "feat: /api/vacancies route with 1h cache"
```

---

### Task 10: Entur transit client

**Files:**
- Create: `lib/entur.ts`, `tests/entur.test.ts`

**Interfaces:**
- Consumes: `LatLon`, `TransitRoute`, `Leg`; `ENTUR_URL`, `CLIENT_NAME`.
- Produces: `getTransit(from: LatLon, to: LatLon, fetchFn?: typeof fetch): Promise<TransitRoute | null>`; `enturDeepLink(from: LatLon, to: LatLon): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/entur.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getTransit } from '../lib/entur';
import polyline from '@mapbox/polyline';

const encoded = polyline.encode([[59.95, 10.78], [59.93, 10.86]]);
const enturResponse = {
  data: { trip: { tripPatterns: [{
    duration: 2580, walkDistance: 1298,
    legs: [
      { mode: 'foot', duration: 360, line: null, pointsOnLink: { points: encoded } },
      { mode: 'bus', duration: 900, line: { publicCode: '23' }, pointsOnLink: { points: encoded } },
    ],
  }] } },
};

describe('getTransit', () => {
  it('maps Entur response to TransitRoute', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(enturResponse), { status: 200 })) as unknown as typeof fetch;
    const r = await getTransit({ lat: 59.95, lon: 10.78 }, { lat: 59.93, lon: 10.86 }, fetchFn);
    expect(r).not.toBeNull();
    expect(r!.durationMin).toBe(43);
    expect(r!.walkDistanceM).toBe(1298);
    expect(r!.legs).toHaveLength(2);
    expect(r!.legs[1]).toEqual({ mode: 'bus', line: '23', durationMin: 15 });
    expect(r!.polyline.length).toBeGreaterThan(0);
    expect(r!.polyline[0][0]).toBeCloseTo(59.95, 2);
  });
  it('returns null when no trip patterns', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: { trip: { tripPatterns: [] } } }), { status: 200 })) as unknown as typeof fetch;
    expect(await getTransit({ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, fetchFn)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entur.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/entur.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/entur.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entur.ts tests/entur.test.ts
git commit -m "feat: Entur transit client"
```

---

### Task 11: OSRM car client

**Files:**
- Create: `lib/osrm.ts`, `tests/osrm.test.ts`

**Interfaces:**
- Consumes: `LatLon`, `CarRoute`; `OSRM_URL_BASE`.
- Produces: `getCar(from: LatLon, to: LatLon, fetchFn?: typeof fetch): Promise<CarRoute | null>`; `googleMapsDeepLink(from: LatLon, to: LatLon): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/osrm.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/osrm.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/osrm.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/osrm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/osrm.ts tests/osrm.test.ts
git commit -m "feat: OSRM car routing client"
```

---

### Task 12: `/api/route` route

**Files:**
- Create: `lib/route-service.ts`, `app/api/route/route.ts`, `tests/route-service.test.ts`

**Interfaces:**
- Consumes: `getTransit`, `enturDeepLink`, `getCar`, `googleMapsDeepLink`, `HOME`, `RouteResult`, `LatLon`.
- Produces: `getRoute(to: LatLon, fetchFn?: typeof fetch): Promise<RouteResult>`; route `GET ?lat=&lon=`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/route-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getRoute } from '../lib/route-service';

describe('getRoute', () => {
  it('combines transit + car and includes deep links', async () => {
    const enturResp = { data: { trip: { tripPatterns: [{ duration: 1800, walkDistance: 500, legs: [{ mode: 'bus', duration: 1800, line: { publicCode: '31' }, pointsOnLink: { points: '' } }] }] } } };
    const osrmResp = { code: 'Ok', routes: [{ duration: 600, distance: 5000, geometry: { coordinates: [[10.8, 59.94], [10.86, 59.92]] } }] };
    const fetchFn = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes('entur') ? enturResp : osrmResp), { status: 200 }),
    ) as unknown as typeof fetch;

    const r = await getRoute({ lat: 59.92, lon: 10.86 }, fetchFn);
    expect(r.transit!.durationMin).toBe(30);
    expect(r.car!.durationMin).toBe(10);
    expect(r.enturUrl).toContain('entur.no');
    expect(r.googleMapsUrl).toContain('google.com/maps');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/route-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/route-service.ts
import type { LatLon, RouteResult } from './types';
import { getTransit, enturDeepLink } from './entur';
import { getCar, googleMapsDeepLink } from './osrm';
import { HOME } from './config';

export async function getRoute(to: LatLon, fetchFn: typeof fetch = fetch): Promise<RouteResult> {
  const [transit, car] = await Promise.all([
    getTransit(HOME, to, fetchFn),
    getCar(HOME, to, fetchFn),
  ]);
  return {
    transit,
    car,
    enturUrl: enturDeepLink(HOME, to),
    googleMapsUrl: googleMapsDeepLink(HOME, to),
  };
}
```

```ts
// app/api/route/route.ts
import { NextResponse } from 'next/server';
import { getRoute } from '@/lib/route-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = parseFloat(params.get('lat') ?? '');
  const lon = parseFloat(params.get('lon') ?? '');
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: 'lat og lon kreves' }, { status: 400 });
  }
  try {
    const route = await getRoute({ lat, lon });
    return NextResponse.json(route);
  } catch (err) {
    return NextResponse.json({ error: 'Kunne ikke hente rute', detail: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/route-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/route-service.ts app/api/route/route.ts tests/route-service.test.ts
git commit -m "feat: /api/route combining transit and car"
```

---

### Task 13: Map component (Leaflet)

**Files:**
- Create: `components/MapView.tsx`, `components/MapView.client.tsx`

**Interfaces:**
- Consumes: `EnrichedVacancy`, `RouteResult`, `HOME`.
- Produces: `<MapView vacancies selectedId route onSelect />` where
  `props: { vacancies: EnrichedVacancy[]; selectedId: string | null; route: RouteResult | null; onSelect: (id: string) => void }`.

This component is verified visually in Task 16 (no unit test — Leaflet needs a DOM/browser).

- [ ] **Step 1: Write the Leaflet inner component**

```tsx
// components/MapView.client.tsx
'use client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EnrichedVacancy, RouteResult } from '@/lib/types';
import { HOME } from '@/lib/config';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

interface Props {
  vacancies: EnrichedVacancy[];
  selectedId: string | null;
  route: RouteResult | null;
  onSelect: (id: string) => void;
}

export default function MapViewClient({ vacancies, selectedId, route, onSelect }: Props) {
  return (
    <MapContainer center={[HOME.lat, HOME.lon]} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker center={[HOME.lat, HOME.lon]} radius={9} pathOptions={{ color: '#111', fillColor: '#111', fillOpacity: 1 }}>
        <Popup>Hjem: {HOME.label}</Popup>
      </CircleMarker>
      {vacancies.filter(v => v.lat != null && v.lon != null).map(v => (
        <Marker key={v.id} position={[v.lat!, v.lon!]} icon={icon}
          eventHandlers={{ click: () => onSelect(v.id) }}>
          <Popup>
            <strong>{v.name}</strong><br />
            {v.spots ?? '?'} plasser · {v.rawAge}<br />
            {v.distanceKm != null ? `${v.distanceKm.toFixed(1)} km i luftlinje` : ''}
          </Popup>
        </Marker>
      ))}
      {route?.transit?.polyline?.length ? (
        <Polyline positions={route.transit.polyline} pathOptions={{ color: '#1565c0', weight: 5, opacity: 0.8 }} />
      ) : null}
      {route?.car?.polyline?.length ? (
        <Polyline positions={route.car.polyline} pathOptions={{ color: '#c62828', weight: 4, opacity: 0.7, dashArray: '6 8' }} />
      ) : null}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Write the SSR-safe wrapper**

```tsx
// components/MapView.tsx
'use client';
import dynamic from 'next/dynamic';
import type { EnrichedVacancy, RouteResult } from '@/lib/types';

const MapViewClient = dynamic(() => import('./MapView.client'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>Laster kart…</div>,
});

interface Props {
  vacancies: EnrichedVacancy[];
  selectedId: string | null;
  route: RouteResult | null;
  onSelect: (id: string) => void;
}
export default function MapView(props: Props) { return <MapViewClient {...props} />; }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/MapView.tsx components/MapView.client.tsx
git commit -m "feat: Leaflet map view with markers and route polylines"
```

---

### Task 14: List, controls, and route panel components

**Files:**
- Create: `components/Controls.tsx`, `components/VacancyList.tsx`, `components/RoutePanel.tsx`

**Interfaces:**
- Consumes: `EnrichedVacancy`, `RouteResult`.
- Produces:
  - `<Controls age onAgeChange count maxCount onCountChange onRefresh loading fetchedAt />`
  - `<VacancyList vacancies selectedId onSelect />`
  - `<RoutePanel route loading vacancy />`

- [ ] **Step 1: Write `Controls.tsx`**

```tsx
// components/Controls.tsx
'use client';
interface Props {
  age: number; onAgeChange: (n: number) => void;
  count: number; maxCount: number; onCountChange: (n: number) => void;
  onRefresh: () => void; loading: boolean; fetchedAt: string | null;
}
export default function Controls({ age, onAgeChange, count, maxCount, onCountChange, onRefresh, loading, fetchedAt }: Props) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: 12, borderBottom: '1px solid #ddd' }}>
      <button onClick={onRefresh} disabled={loading}
        style={{ padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}>
        {loading ? 'Henter…' : 'Hent ledige barnehager'}
      </button>
      <label>Alder: <strong>{age} år</strong>
        <input type="range" min={0} max={6} value={age} onChange={e => onAgeChange(Number(e.target.value))} />
      </label>
      <label>Vis: <strong>{count}</strong>
        <input type="range" min={1} max={Math.max(1, maxCount)} value={count} onChange={e => onCountChange(Number(e.target.value))} />
        <span> / {maxCount}</span>
      </label>
      {fetchedAt && <span style={{ marginLeft: 'auto', color: '#666', fontSize: 13 }}>
        Oppdatert: {new Date(fetchedAt).toLocaleString('no-NO')}
      </span>}
    </div>
  );
}
```

- [ ] **Step 2: Write `VacancyList.tsx`**

```tsx
// components/VacancyList.tsx
'use client';
import type { EnrichedVacancy } from '@/lib/types';
interface Props { vacancies: EnrichedVacancy[]; selectedId: string | null; onSelect: (id: string) => void; }
export default function VacancyList({ vacancies, selectedId, onSelect }: Props) {
  if (!vacancies.length) return <p style={{ padding: 16, color: '#666' }}>Ingen treff. Trykk «Hent ledige barnehager».</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {vacancies.map(v => (
        <li key={v.id} onClick={() => onSelect(v.id)}
          style={{ padding: 12, borderBottom: '1px solid #eee', cursor: 'pointer',
            background: v.id === selectedId ? '#eef4ff' : 'transparent' }}>
          <div style={{ fontWeight: 600 }}>{v.name}</div>
          <div style={{ fontSize: 13, color: '#444' }}>
            {v.bydel} · {v.spots ?? '?'} plasser · {v.rawAge}
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {v.distanceKm != null ? `${v.distanceKm.toFixed(1)} km i luftlinje` : 'Ukjent posisjon'}
            {v.availableFrom ? ` · ledig fra ${v.availableFrom}` : ''}
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write `RoutePanel.tsx`**

```tsx
// components/RoutePanel.tsx
'use client';
import type { RouteResult, EnrichedVacancy } from '@/lib/types';
interface Props { route: RouteResult | null; loading: boolean; vacancy: EnrichedVacancy | null; }
export default function RoutePanel({ route, loading, vacancy }: Props) {
  if (!vacancy) return null;
  return (
    <div style={{ padding: 12, borderTop: '1px solid #ddd', fontSize: 14 }}>
      <strong>{vacancy.name}</strong>
      {vacancy.address && <div style={{ color: '#666' }}>{vacancy.address}</div>}
      {loading && <p>Beregner ruter…</p>}
      {route && (
        <>
          <div style={{ marginTop: 8 }}>
            🚌 <strong>Kollektiv:</strong>{' '}
            {route.transit ? `${route.transit.durationMin} min` : 'ingen rute'}
            {route.transit && (
              <div style={{ color: '#444' }}>
                {route.transit.legs.map((l, i) =>
                  `${l.mode === 'foot' ? 'gå' : l.mode} ${l.line ? l.line + ' ' : ''}${l.durationMin}min`
                ).join(' → ')}
                {` (gange ${route.transit.walkDistanceM} m)`}
              </div>
            )}
            <a href={route.enturUrl} target="_blank" rel="noreferrer">Åpne i Entur ↗</a>
          </div>
          <div style={{ marginTop: 8 }}>
            🚗 <strong>Bil:</strong>{' '}
            {route.car ? `${route.car.durationMin} min · ${route.car.distanceKm.toFixed(1)} km` : 'ingen rute'}{' '}
            · <a href={route.googleMapsUrl} target="_blank" rel="noreferrer">Åpne i Google Maps ↗</a>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/Controls.tsx components/VacancyList.tsx components/RoutePanel.tsx
git commit -m "feat: controls, vacancy list, and route panel components"
```

---

### Task 15: Main page wiring

**Files:**
- Create: `app/page.tsx`

**Interfaces:**
- Consumes: all components; `EnrichedVacancy`, `RouteResult`; `matchesAge`.
- Produces: the full interactive page. Default age 2, default count 10, count max = matched length, fetch on mount + on button.

- [ ] **Step 1: Write `app/page.tsx`**

```tsx
// app/page.tsx
'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { EnrichedVacancy, RouteResult } from '@/lib/types';
import { matchesAge } from '@/lib/age';
import Controls from '@/components/Controls';
import VacancyList from '@/components/VacancyList';
import RoutePanel from '@/components/RoutePanel';
import MapView from '@/components/MapView';

export default function Page() {
  const [all, setAll] = useState<EnrichedVacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [age, setAge] = useState(2);
  const [count, setCount] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const fetchVacancies = useCallback(async (refresh: boolean) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/vacancies${refresh ? '?refresh=1' : ''}`);
      if (!res.ok) throw new Error('Henting feilet');
      const data = await res.json();
      setAll(data.vacancies); setFetchedAt(data.fetchedAt);
    } catch (e) {
      setError('Kunne ikke hente ledige barnehager. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVacancies(false); }, [fetchVacancies]);

  const matched = useMemo(() => all.filter(v => matchesAge(v.ageGroup, age)), [all, age]);
  const shown = useMemo(() => matched.slice(0, count), [matched, count]);
  const selected = useMemo(() => shown.find(v => v.id === selectedId) ?? null, [shown, selectedId]);

  // keep count within bounds when matched set changes
  useEffect(() => {
    if (matched.length && count > matched.length) setCount(matched.length);
  }, [matched.length, count]);

  const onSelect = useCallback(async (id: string) => {
    setSelectedId(id);
    const v = all.find(x => x.id === id);
    if (!v || v.lat == null || v.lon == null) { setRoute(null); return; }
    setRouteLoading(true); setRoute(null);
    try {
      const res = await fetch(`/api/route?lat=${v.lat}&lon=${v.lon}`);
      setRoute(res.ok ? await res.json() : null);
    } finally {
      setRouteLoading(false);
    }
  }, [all]);

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '10px 12px', background: '#111', color: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Ledige barnehageplasser i Oslo</h1>
      </header>
      <Controls
        age={age} onAgeChange={setAge}
        count={count} maxCount={matched.length} onCountChange={setCount}
        onRefresh={() => fetchVacancies(true)} loading={loading} fetchedAt={fetchedAt}
      />
      {error && <div style={{ padding: 10, background: '#fdecea', color: '#b71c1c' }}>{error}</div>}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <section style={{ width: 380, overflowY: 'auto', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', color: '#666', fontSize: 13 }}>
            {matched.length} treff for {age} år · viser {shown.length}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <VacancyList vacancies={shown} selectedId={selectedId} onSelect={onSelect} />
          </div>
          <RoutePanel route={route} loading={routeLoading} vacancy={selected} />
        </section>
        <section style={{ flex: 1 }}>
          <MapView vacancies={shown} selectedId={selectedId} route={route} onSelect={onSelect} />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: type-check passes; Next build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire main page (filters, list, map, routes)"
```

---

### Task 16: End-to-end verification + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (sanity, config, parse-vacancies, age, distance, parse-detail, cache, enrich, vacancies-service, entur, osrm, route-service).

- [ ] **Step 2: Start the app and verify manually**

Run: `npm run dev` then open `http://localhost:3000`.
Verify against this checklist:
- Page loads; list auto-populates with real Oslo kindergartens (default age 2, showing up to 10).
- Map shows the black home marker at Traverveien 14 plus kindergarten markers.
- Moving the **Alder** slider changes which kindergartens appear (age 2 hides "over 3 år"-only spots; age 4 shows them).
- Moving the **Vis** slider changes the number shown; max equals the match count.
- Clicking **Hent ledige barnehager** re-fetches (network tab shows `/api/vacancies?refresh=1`).
- Clicking a kindergarten (list or map) draws a blue transit line + red dashed car line and fills the route panel with durations, leg summary, and Entur/Google Maps links.

- [ ] **Step 3: Write `README.md`**

```markdown
# Barneplass Oslo

Finds and maps available kindergarten spots ("ledige barnehageplasser") in Oslo,
showing distance and transit + car routes from Traverveien 14, 0588 Oslo.

## Run

    npm install
    npm run dev      # http://localhost:3000
    npm test         # unit tests

## How it works

- `/api/vacancies` scrapes oslo.kommune.no, parses listings, and enriches each
  kindergarten with coordinates + address from its detail page (cached 1h).
- `/api/route` returns transit (Entur) and car (OSRM) routes from home.
- Filter by child age (default 2) and number shown (default 10, max = all matches).

## Data sources (no API keys)

oslo.kommune.no · Entur Journey Planner · OSRM · OpenStreetMap. Home address is
hardcoded in `lib/config.ts`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README and verify end-to-end"
```

---

## Self-Review

**Spec coverage:**
- List available kindergartens → Tasks 3, 9, 14, 15. ✓
- Filter / set age, default 2 → Tasks 4, 14, 15. ✓
- Map display → Tasks 13, 15. ✓
- Distance from home → Tasks 2, 5, 8. ✓
- Transit + car routes per kindergarten → Tasks 10, 11, 12, 14, 15. ✓
- Default shown 10, max = all matches → Tasks 14 (`maxCount`), 15 (`count`/`matched.length`). ✓
- Re-fetch button → Tasks 9 (`?refresh=1`), 14, 15. ✓
- Scrape oslo.kommune.no (chosen source) → Tasks 3, 6, 8, 9. ✓

**Type consistency:** `EnrichedVacancy`, `RouteResult`, `TransitRoute`, `CarRoute`, `Leg`, `LatLon` defined in Task 2 and used verbatim by all later tasks. `polyline` is `[number,number][]` ([lat,lon]) everywhere; OSRM flips `[lon,lat]→[lat,lon]` in Task 11; Entur decode yields `[lat,lon]` in Task 10. Cache API (`get`/`set`) consistent across Tasks 7–9. `getVacancies`/`getRoute`/`enrichVacancies` signatures consistent between service and route tasks.

**Placeholder scan:** No TBD/TODO; every code step contains full code; every test step contains real assertions.

**Risk note:** Fuzzy name-matching was eliminated — coordinates come directly from each detail page, removing the spec's main technical risk. If `pointsOnLink` is ever absent from Entur, the transit polyline is simply empty (durations/legs still render); not a failure.
