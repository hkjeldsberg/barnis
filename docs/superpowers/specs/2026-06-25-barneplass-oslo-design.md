# Barneplass Oslo — Available Kindergarten Finder

**Date:** 2026-06-25
**Status:** Approved design

## Goal

A web app that finds available kindergarten spots ("ledige barnehageplasser") in
Oslo, lists them, shows them on a map with distance from a fixed home address
(Traverveien 14, 0588 Oslo), and shows suggested public-transport and car routes
for each kindergarten. The user can filter by child age (default 2 years), control
how many kindergartens are shown (default 10, max = all found), and re-fetch
availability on demand via a button.

## Data sources (all free, no API keys)

| Purpose | Source | Notes |
|---|---|---|
| Vacancies (ledige plasser) | `https://www.oslo.kommune.no/barnehage/ledige-barnehageplasser/` | Static HTML, manually maintained, grouped by bydel. Scraped + parsed. |
| Coordinates / address | Utdanningsdirektoratet barnehageregister / barnehagefakta API | Match by name to attach lat/lon + address. |
| Public transport routes | Entur Journey Planner (GraphQL) | Free, keyless (requires `ET-Client-Name` header). |
| Car routes | OSRM public demo server | Free, keyless. Duration, distance, geometry. |
| Geocoding (home) | Nominatim / hardcoded fallback | Home address geocoded once; hardcoded coords as fallback. |
| Map tiles | OpenStreetMap via Leaflet | Free, keyless. |
| External deep-links | Google Maps, Entur | Open turn-by-turn externally; no key needed. |

## Architecture

Single **Next.js (App Router, TypeScript)** application. All external calls run in
server-side API routes (avoids CORS and keeps any future keys server-side). The
client is a React page with a Leaflet map and a list/filter UI.

```
Browser (React + Leaflet map + list/filters)
        │  fetch
        ▼
Next.js API routes (server)
   /api/vacancies   → scrape oslo.kommune.no, parse, match to register, cache
   /api/route       → Entur (transit) + OSRM (car) for one kindergarten
        │
        ▼
 External: oslo.kommune.no • barnehagefakta/udir • Entur • OSRM • Nominatim
```

## Components

- **Scraper/parser** (`lib/vacancies.ts`): fetch the Oslo page, parse each entry into
  `Vacancy { bydel, name, spots, ageGroup, availableFrom, lastUpdated }`. The most
  fragile, logic-heavy part — unit tested against saved sample HTML.
- **Register matcher** (`lib/register.ts`): normalize names and match each vacancy to
  the kindergarten register to attach `{ lat, lon, address }`. Unmatched entries are
  still listed but flagged "no map location"; fallback is geocoding name + bydel.
- **Distance** (`lib/distance.ts`): straight-line (haversine) distance from home to
  each kindergarten, used for default sorting.
- **Route aggregator** (`lib/route.ts` + `/api/route`): given a kindergarten, call
  Entur (transit) and OSRM (car); return durations, transit leg summary, and
  polylines. Lazy — only for the selected kindergarten.
- **Age matcher** (`lib/age.ts`): map a child age to the vacancy age buckets
  (e.g. 2 år → "under 3 / 0–3"). Unit tested.
- **UI** (`app/page.tsx` + components): top bar, list, map, route panel.

## Data flow

1. **Fetch vacancies** — on first load and when the "Hent ledige barnehager" button
   is pressed. Server scrapes + parses + enriches with coordinates, caches result.
2. **Filter + sort** — client filters by selected age and shows top N (default 10)
   sorted by straight-line distance.
3. **Select kindergarten** — calls `/api/route`, draws transit + car polylines on the
   map, and fills the route panel.

## UI

- **Top bar**: "Hent ledige barnehager" button (force refresh), age input
  (default **2 år**), "show N" control (default **10**, max = total found),
  last-updated timestamp.
- **Left**: ranked list by distance — name, bydel, spots, age group, available-from,
  distance. Click selects.
- **Right**: Leaflet map with home marker + kindergarten markers. Selecting one draws
  transit + car routes and shows a route panel: transit duration + leg summary, car
  duration + distance, and Google Maps / Entur deep-links.

## Error handling & caching

- Server caches scraped vacancies (~1h); the button forces a refresh. Route results
  cached per kindergarten.
- Scrape/source failure: show a banner, keep last good data.
- Unmatched kindergartens degrade gracefully (listed, no map pin).

## Testing

- Unit tests for the **parser** (saved sample HTML) and **age-matching** logic.
- Mocked tests for **route aggregation** (Entur/OSRM responses).

## Decisions / non-goals

- No real-time vacancy API exists for Oslo; the manually-maintained Oslo page is the
  source of truth and is scraped.
- No API keys required.
- Home address is hardcoded (editable in code), not a user-facing setting.
- No authentication, no persistence beyond in-memory/server cache.
- Fuzzy name-matching between the vacancy page and the register is the key technical
  risk; mitigated by name normalization + geocoding fallback + graceful degradation.
