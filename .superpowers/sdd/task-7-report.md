# Task 7: TTL Cache Utility — Report

## Status
**COMPLETE** ✓

## Files Created
- `lib/cache.ts` — TTLCache generic class with get/set methods and TTL expiration
- `tests/cache.test.ts` — 2-test suite covering value retention and expiration

## Test Summary
**2 passed (100%)**
- ✓ returns stored value before expiry
- ✓ expires value after ttl

## Implementation Notes
- `TTLCache<T>` is a generic in-memory cache with Map-backed storage
- Constructor accepts `ttlMs` and optional `now` time function (defaults to `Date.now()`)
- `get(key)` returns undefined if key missing or expired; auto-deletes expired entries
- `set(key, value)` stores value with expiration timestamp calculated as `now() + ttlMs`
- Used by downstream Task 8 (enrichVacancies) and Task 9 (vacancies service)

## Concerns
None — implementation is straightforward, testable, and matches specification exactly.
