# Task 6: Detail-page parser (coordinates + address)

## Status
**COMPLETE** ✓

## Files Created
- `lib/parse-detail.ts` — parses HTML detail pages to extract coordinates (lat/lon) from `ods-map` component's encoded JSON state and address from definition list
- `tests/parse-detail.test.ts` — 3 test cases covering coordinate extraction, address extraction, and null fallback

## Test Summary
All 3 tests pass in 29ms:
- ✓ extracts coordinates from encoded JSON state (latitude/longitude)
- ✓ extracts visiting address from `<dt>Besøksadresse</dt>` + `<dd>` pair with whitespace normalization
- ✓ returns null for all fields when data absent

## Concerns
None. Implementation handles:
- HTML entity decoding (`&quot;` → `"`) for inline JSON parsing
- Regex pattern match for latitude/longitude with optional quotes and decimals
- Safe cheerio DOM traversal with case-insensitive address label matching
- Proper whitespace normalization on extracted address text
