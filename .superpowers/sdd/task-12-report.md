# Task 12 Report: /api/route route

## Status
COMPLETE

## Files Created
- `tests/route-service.test.ts` — test for `getRoute` combining transit + car with deep links
- `lib/route-service.ts` — `getRoute(to, fetchFn?)` calls `getTransit` and `getCar` in parallel, returns `RouteResult` with Entur + Google Maps deep links
- `app/api/route/route.ts` — Next.js App Router GET handler for `/api/route?lat=&lon=`, returns 400 on missing/invalid params, 502 on upstream errors

## Test Summary
1 passed, 0 failed — `npx vitest run tests/route-service.test.ts` green on first run after implementation.

## Concerns
None. The `pointsOnLink.points` empty-string case in the test (Entur leg with `points: ''`) is handled gracefully by `getTransit` — the polyline decode is wrapped in try/catch and simply produces no points, so transit is still returned with correct duration/legs.
