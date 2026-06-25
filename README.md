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
  Add `?refresh=1` to force a re-scrape.
- `/api/route?lat=&lon=` returns transit (Entur) and car (OSRM) routes from home.
- The UI lets you filter by child age (default 2) and number shown (default 10,
  max = all matches), and re-fetch on demand via the "Hent ledige barnehager" button.

## Data sources (no API keys)

oslo.kommune.no · Entur Journey Planner · OSRM · OpenStreetMap. The home address
is hardcoded in `lib/config.ts`.

## Architecture

Next.js App Router (TypeScript). All external calls run in server-side API routes
(`app/api/*`). Pure logic lives in `lib/` with unit tests in `tests/`. The map is
Leaflet via `react-leaflet`, loaded client-side only.
