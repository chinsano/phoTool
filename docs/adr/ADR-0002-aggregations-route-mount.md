# ADR-0002: Aggregations route mount

Status: Proposed
Date: 2025-10-13

Context
The server currently mounts tag aggregations under `/api/tags/aggregate`. Phase 4 introduces Tag CRUD under `/api/tags`, which risks route collision and coupling (mixing analytics with entity CRUD). Rules favor clear boundaries and ports/adapters separation.

Decision
Mount tag aggregations under `/api/aggregations` instead of mounting the aggregations router at `/api/tags`. Keep a temporary alias at `/api/tags/aggregate` for backward compatibility during the transition.

Consequences
Positive:
- Clear separation between entity CRUD (`/api/tags`), aggregations (`/api/aggregations`), and file operations (`/api/files/*`).
- Easier to reason about permissions, caching, and evolution of analytics.

Negative:
- Requires updating references in docs/tests/clients.
- Transitional duplication until alias is removed.

Follow-ups:
- Update `server/src/app.ts` mounts and plan references.
- Adjust tests and any clients to prefer `/api/aggregations`.

References
- `docs/phoTool.plan.md` Phase 4
- `server/src/routes/aggregations.ts`

