# ADR-0003: Placeholder geocoder scope, precision, and caching

Status: Accepted (Updated 2025-10-13)
Date: 2025-10-13

Context
  We need deterministic placeholder expansion for `country`, `state`, and `city` based on file EXIF data and coordinates. We require a solution that:
  - Works out-of-box without complex dataset management
  - Provides administrative-level accuracy (city, state, country)
  - Respects reasonable usage limits for a portable app
  - Maintains predictable outputs with caching to avoid repeated lookups

Decision
  - **Sources and precedence**: Use EXIF textual fields first when present and normalized; otherwise, use BigDataCloud online reverse geocoding API.
  
  - **Online service (BigDataCloud)**: 
    - Endpoint: `https://api.bigdatacloud.net/data/reverse-geocode-client`
    - No API key required; operates under Fair Use Policy
    - Returns administrative-level data: locality, city, principalSubdivision (state), countryName
    - No strict rate limits (reasonable usage expected)
    - Works in portable builds without configuration
  
  - **Precision policy**: Round coordinates to a configurable decimal precision (default 3 decimals ≈ 111m) to form cache keys. The cache key schema is `(lat_rounded, lon_rounded, precision)`.
  
  - **Caching**: Persist results in SQLite table `geo_cache` with a unique index over `(lat_rounded, lon_rounded, precision)`; write-through after successful lookup. Include `source` ('exif'|'bigdatacloud') and `updated_at`.
  
  - **Error handling**: 
    - Timeout: 5 seconds (configurable)
    - Retries: 2 attempts with exponential backoff
    - Network failures gracefully degrade (return undefined, log error)
    - Cached results always used when available (even if API is unreachable)
  
  - **Canonical formatting**: Tag labels are deterministic and ASCII-safe; country/state/city capitalized in Title Case; slugs derived by lowercasing, trimming, replacing spaces with `-`, and stripping non-alphanumerics.
  
  - **Attribution**: BigDataCloud data is used in compliance with their Fair Use Policy. No specific attribution requirement for administrative-level reverse geocoding endpoint.

Consequences
  Positive:
    - Zero configuration: works immediately in portable builds
    - No dataset downloads, preprocessing, or binary size increase
    - Always up-to-date: no manual dataset updates needed
    - Administrative-level accuracy perfect for placeholder needs
    - Fair Use Policy allows reasonable batch processing
    - Deterministic outputs via caching
    - Cache-first approach handles offline scenarios gracefully
  
  Negative:
    - Requires internet connectivity for first lookup (cached thereafter)
    - Fair Use Policy has undefined hard limits (must be reasonable)
    - Less detailed than polygon-based solutions for edge cases
    - Network failures delay placeholder expansion (degrades gracefully)
  
  Follow-ups:
    - Monitor cache hit rates to optimize precision settings
    - Consider optional LocationIQ integration for power users needing higher quality
    - Implement cache expiry/refresh policy if needed
    - Add metrics for API success/failure rates

References
  - Plan Phase 5 tasks
  - `packages/shared/src/contracts/placeholders.ts`
  - `packages/shared/src/ports/placeholders.ts`
  - BigDataCloud Reverse Geocoding API: https://www.bigdatacloud.com/free-api/free-reverse-geocode-api


