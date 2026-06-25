# Barneplass Oslo — SDD Progress Ledger

Branch: feat/barneplass-oslo. RULE: no git commands (local CLAUDE.md). No commits.

- Task 1: complete (scaffold + vitest; sanity 1/1 pass). Concern: next@14.2.5 audit warning (pinned per plan).
- Task 2: complete (types + config; 1/1).
- Tasks 3,4,5,6,7,10,11: complete (parser, age, distance, detail, cache, entur, osrm). Full suite 21/21 pass.
- Tasks 8,12,13,14: complete (enrich, route-service+api, MapView, UI components). tsc clean.
- Task 9: complete (vacancies-service + /api/vacancies).
- Task 15: complete (app/page.tsx). tsc clean, npm run build succeeds.
- Task 16: complete. Full suite 27/27 pass; build OK; live e2e verified (18 real kindergartens geocoded + sorted; transit+car routes with polylines). README written.

## Post-build fixes (from verification + final review)
- Parser: strip trailing ":" when the colon sits inside the <a> tag (real data nit). +test.
- vacancies-service: throw on upstream non-2xx; don't cache empty results (spec error-handling). +test.

## Final review: APPROVED (no Critical/Important). Deferred MINOR findings (not blocking):
- enrich.ts: unbounded Promise.all fetch concurrency (fine at 18; add limit if list grows). 24h detail cache mitigates.
- entur.ts: enturDeepLink uses nearby-stop-place-detail path; may not pre-fill a journey — verify/replace URL format.
- parse-vacancies availableFrom regex could grab a stop-word on unusual phrasing (cosmetic).
- MapView Polyline siblings lack key (cosmetic remount); RoutePanel unused loop index (lint).
- entur GraphQL interpolation is safe (parseFloat-guarded) but could use GraphQL variables for hardening.
- SSRF: detailUrl from scraped href is server-fetched without host allow-list (trust boundary = oslo.kommune.no; low risk).
