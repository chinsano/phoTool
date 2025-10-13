# EH-0001: Batch sync processing and reporting

Status: Proposed
Date: 2025-10-13

## Context
Manual sync endpoints exist (`/api/sync/import`, `/api/sync/write`) and operate on provided files. For large sets, we need batch processing with progress reporting, cancellation, and resumability hooks.

## Proposal
Introduce a server-side job system to process sync operations asynchronously:
- Job types: `import`, `write` (later: `scan`, `sync` variants)
- Endpoints:
  - `POST /api/sync/jobs` { type, payload } → { jobId }
  - `GET /api/sync/jobs/:jobId` → status snapshot { state, counts, errors[] }
  - `DELETE /api/sync/jobs/:jobId` → cancel if running/queued
- Progress fields per job: { total, processed, succeeded, failed, startedAt, updatedAt }
- Respect config:
  - `sync.allowManualImport`, `sync.allowManualWrite`
  - `exif.writeMode`, `exif.readPreference`
  - Concurrency from `exiftool.maxConcurrent`

## Scope
- In: In-process queue, per-job progress, cancellation, error aggregation, simple persistence.
- Out (later EHs): Distributed workers, resumable checkpoints across restarts, UI screens, per-tag diffs.

## Architecture / APIs / Data
- Queue: In-memory with bounded concurrency; when `jobs` DB table is available, persist status snapshots.
- Suggested table (later): `jobs(id, type, payload_json, status, created_at, updated_at, counts_json, errors_json)`
- Worker: Drives ExifToolService operations in batches; observes config; per-file try/catch; periodic status flush.
- APIs:
  - `POST /api/sync/jobs` — accepts { type: 'import'|'write', payload: { files: string[], subjects?, hierarchical? } }
  - `GET /api/sync/jobs/:id` — returns { state: 'queued'|'running'|'completed'|'failed'|'canceled', progress, summary }
  - `DELETE /api/sync/jobs/:id` — cancel

## Acceptance criteria
- Can create an import job for N files; progress reflects counts; final summary matches per-file outcomes.
- Can create a write job honoring `exif.writeMode`; final files/sidecars reflect requested tags.
- Can cancel a running job; remaining items untouched; state becomes `canceled`.
- Config flags are enforced (manual-only policy).
- Unit tests for queue behavior; integration tests for small batches with fixtures.

## Risks / Open questions
- Process crash mid-job: initial version may lose in-memory progress; mitigation via periodic DB persistence (follow-up).
- Starvation: ensure fair scheduling across jobs (simple FIFO acceptable initially).
- Large error lists: cap stored errors and stream logs via server logger.

## References
- ADR-0001 Exif/XMP policy
- Current sync endpoints and ExifToolService
