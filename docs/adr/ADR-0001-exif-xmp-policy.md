# ADR-0001: Exif/XMP tag storage policy and delimiter conventions

Status: Accepted
Date: 2025-10-13

## Context
- phoTool reads/writes tags using ExifTool. Tags of interest: flat `XMP-dc:Subject` and hierarchical `XMP-lr:HierarchicalSubject`.
- Directly mutating embedded EXIF inside media files can be slow, risky (data loss on failure), and may conflict with other tools.
- XMP sidecars (`*.xmp`) are well-supported, atomic to create/replace, and reversible.
- We also need a deterministic hierarchical path delimiter and read/write precedence rules.

## Decision
- Write policy: Sidecar-first by default. All write operations target the XMP sidecar (`*.xmp`).
- Embedded writes: Supported as an explicit, opt-in path (separate methods). Off by default.
- Read precedence: Prefer sidecar when present; otherwise read embedded metadata from the media file.
- Hierarchical delimiter: Use `|` to join path segments (e.g., `People|Family|Alice`). No escaping is performed; segments must not contain `|`.
- Flat subjects: Stored in `XMP-dc:Subject` as an array of strings.
- Safety and performance guards:
  - Bounded concurrency and command timeouts when calling ExifTool.
  - Path normalization and argument allowlist for ExifTool invocations.

## Consequences
- Positive:
  - Safer writes (sidecar creation is atomic; original media is not mutated by default).
  - Faster typical operations and simpler rollback.
  - Deterministic read semantics (sidecar-first) avoids drift.
- Negative:
  - Tools that only read embedded EXIF won’t see changes unless embedded writes are also performed.
  - Extra sidecar files increase file count in directories.

## Follow-ups / Strategy
- Configuration (future extension):
  - `exif.writeMode`: "sidecar-only" | "embedded-only" | "both" (default "sidecar-only").
  - `exif.readPreference`: "sidecar-first" | "embedded-first" (default "sidecar-first").
  - Keep current defaults equivalent to sidecar-only writes and sidecar-first reads.
- API / Ports:
  - Sidecar methods: `writeSubjects`, `writeHierarchicalSubjects` (existing).
  - Embedded methods: `writeEmbeddedSubjects`, `writeEmbeddedHierarchicalSubjects` (opt-in) (existing).
- Testing:
  - Unit tests for mapping utils and date parsing.
  - Integration tests for sidecar and embedded round-trips using tiny fixtures (present).
- Documentation:
  - Note delimiter caveat: `|` cannot appear in a segment; if needed later, introduce escaping or an alternative representation.

## References
- ExifTool documentation on XMP-dc and XMP-lr tags.
- PRs implementing ExifTool service, mapping, config loader, and integration tests.
