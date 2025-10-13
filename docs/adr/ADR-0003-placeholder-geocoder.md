# ADR-0003: Placeholder geocoder scope, precision, and caching

Status: Accepted
Date: 2025-10-13

Context
  We need deterministic placeholder expansion for `country`, `state`, and `city` based on file EXIF data and coordinates. Online services are out of scope; we must work offline and ensure predictable outputs with a cache to avoid repeated reverse lookups.

Decision
  - Sources and precedence: Use EXIF textual fields first when present and normalized; otherwise, use an offline reverse geocoder.
  - Offline dataset: Built-in country polygons for country detection; optional GeoNames pack (or similar gazetteer) for state/city when enabled via config. If disabled or unknown, omit that token.
  - Precision policy: Round coordinates to a configurable decimal precision (default 3–4 decimals) to form cache keys; future alternative: geohash length N. The cache key schema is `(lat_rounded, lon_rounded, precision)`.
  - Caching: Persist results in SQLite table `geo_cache` with a unique index over `(lat_rounded, lon_rounded, precision)`; write-through after successful lookup. Include `source` (exif|offline) and `updated_at`.
  - Canonical formatting: Tag labels are deterministic and ASCII-safe; country/state/city capitalized in Title Case; slugs derived by lowercasing, trimming, replacing spaces with `-`, and stripping non-alphanumerics.

Consequences
  Positive:
    - Deterministic outputs; reduced repeat cost through caching.
    - Works fully offline; configurable precision balances accuracy and hit rate.
  Negative:
    - Polygon/gazetteer data increases binary size if enabled.
    - Rounding can cause boundary ambiguity at small precisions.
  Follow-ups:
    - Consider geohash-based keys when adding multiple datasets.
    - Periodically refresh `geo_cache` entries if datasets change.

References
  - Plan Phase 5 tasks
  - `packages/shared/src/contracts/placeholders.ts`
  - `packages/shared/src/ports/placeholders.ts`


