<!-- 63478c21-7d45-4d3b-8cbb-386572c54182 04af0e36-9283-4949-9476-3a9ef286a868 -->
# phoTool – Node+TypeScript Architecture and Implementation Plan

### Stack

- Backend: Node.js + TypeScript, Express, Drizzle ORM + SQLite (better-sqlite3), `exiftool-vendored` (stay_open), `sharp` for thumbnails
- Frontend: React + Vite + TypeScript, dnd-kit, TanStack Router, Zustand, Tailwind (or CSS Modules), Testing Library + Vitest
- E2E/Docs: Playwright, Storybook (components), in-app `/zoo` route (flows), shared fixtures
- Packaging: Portable folder via `pkg` (or `nexe`) bundling server and static web, ExifTool binary, SQLite DB

### Repo layout

- `server/` – Express app, ExifTool service, DB, API
- `web/` – React app (Vite), routes, UI modules
- `packages/shared/` – shared TypeScript types/schemas (Zod)
- `packages/ui/` – reusable components (consumed by web + Storybook)
- `packages/fixtures/` – sample data/props for stories and `/zoo`
- `tutorials/` – shipped interactive tutorial scripts (JSON/TS)
- `i18n/` – UI text matrix (`en/ui.json`, `de/ui.json`)
- `data/` – runtime files (`ui-state.json`, `phoTool.db`, caches, optional geodata, smart album JSON)

### Data model (SQLite via Drizzle)

- `files(id, path, dir, name, ext, size, mtime, ctime, width, height, duration, lat, lon, taken_at, xmp_path NULL, xmp_mtime NULL, last_indexed_at)`
- `tags(id, name, slug, color, group, parent_id NULL, source 'user'|'auto')`
- `file_tags(file_id, tag_id)`
- `tag_groups(id, name)` and `tag_group_items(group_id, tag_id)`
- `thumbnails(file_id, mtime, hash, path)`
- `jobs(id, type, payload_json, status, created_at, updated_at)`
- `sources(id, signature, roots_json, last_scanned_at)` // tracks normalized source sets for caching

### Exif/XMP synchronization

- Fields: `XMP-dc:Subject`, `XMP-lr:HierarchicalSubject`; sidecars `*.xmp`.
- Modes: add/overwrite; directions: exif↔xmp↔db; newest-wins unless overwrite.

### Application state persistence

- Save UI state JSON after changes to `data/ui-state.json` (atomic write, debounced, backups).
- Schema in `packages/shared/uiState.ts`; hydrate with migrations; BroadcastChannel sync; includes active filter chain and current sources.

### UI text matrix + contextual help

- Per-language JSON mapping `UIElementId` → `{ label, hint, doc }`.
- `useI18n()` returns text with fallback; interactive elements carry `data-uiid`.
- Help-mode toggled by `?`: custom cursor, hover shows `DocPopover` with `doc`. ESC exits.

### Tag Library: tabs, placeholders, groups, and deletion semantics

- Tabs: `Automatic`, `User Defined` (built-in group), plus user-created groups.
- `Automatic` shows placeholder tags: `Year`, `Month`, `Day`, `Weekday`, `Country`, `State`, `City`.
- Placeholders are tokens until applied; concrete tags (e.g., `Year 2025`) are lazily created with `source='auto'`.
- `User Defined` content reflects all tags available in any file under the current source directories, plus manually created tags (even if 0 usage). Counts are shown; search and context menus apply as specified.
- Delete semantics (keyboard Del or context menu): (1) Filter Node → remove from that node only. (2) Tags → Selection → remove from selected pictures (DB + XMP/EXIF sync queue). (3) Tags → Library → unlink from current Library group and remove from currently selected pictures; tag entity remains unless explicit “Delete tag everywhere”.

### Tag-based Filter Builder

- Starting Node (fixed) + a Connector behind each node with options: `and|or|and not|none` + any number of Nodes to the right.
- Default: Starting Node + connector=`none`.
- Changing a connector from `none` to another value creates a Node to its right; setting any connector back to `none` deletes all nodes to its right.
- Node: `mode: all|any`, `tagIds[]` (placeholders expanded in this context).
- Chain JSON (packages/shared/filters.ts):
  ```ts
  type NodeMode = 'all'|'any'
  type Connector = 'and'|'or'|'and-not'|'none'
  interface FilterNode { id: string; mode: NodeMode; tagIds: string[] }
  interface FilterChain { start: FilterNode; links: { connector: Exclude<Connector,'none'>; node: FilterNode }[] }
  ```

- SQL evaluation: left-to-right via CTEs using `INTERSECT/UNION/EXCEPT`; indexes on `file_tags(tag_id,file_id)`.

### Smart Albums (file-based JSON)

- JSON files live in `data/albums/*.json` and are the source of truth.
- Schema (versioned):
  ```json
  {
    "version": 1,
    "name": "South England",
    "sources": ["C:/User/Media"],
    "filter": { /* FilterChain as above */ }
  }
  ```

- UI actions in Smart Albums panel:
  - Load: clears current directories and filter chain; sets directories to `sources` and reconstructs all nodes/connectors/tags from JSON.
  - Update: writes current directories + filter chain to the album JSON (atomic write with backup).
  - Add: creates a new album file from current state (name prompt).
  - Delete: removes the JSON file.
- After Load or any filter change: recompute the selection, switch the view to Statistics automatically, refresh Tags → Selection to show tags in the current selection, and refresh Tags → Library → User Defined to show all tags present under current sources.

### Performance and smart refresh (new)

- Normalized source set signature: `signature = sha1(JSON.stringify(sort(normalizePaths(roots))))`. Stored in `sources` table.
- Scan cache: For a given signature, remember `last_scanned_at` and per-file stat snapshot (`size`, `mtime`, `xmp_mtime`).
- Incremental scan algorithm:

1) Compare current roots signature with previous; if unchanged, skip full rescan.

2) For each root, list directory entries; only re-index files whose (`size`,`mtime`) or sidecar `xmp_mtime` changed or records missing.

3) Read metadata with ExifTool only for changed files; otherwise reuse DB values.

4) Maintain a tombstone list for deleted files to prune DB/thumbnail cache.

- Album Load optimization:
  - If the album’s `sources` signature equals the current signature, do not rescan; only rebuild the selection from the new filter.
  - If different but overlapping, scan per-root and only process the delta.
- Aggregation caches:
  - None persisted; counts are computed from indexed tables which are fast with proper indexes. Optional in-memory LRU keyed by (signature, filter hash) to short-circuit repeated queries during rapid edits.
- APIs:
  - `POST /api/scan` { roots, mode?: 'auto'|'full' } — `auto` = incremental using the cache; `full` forces re-read.
  - `GET /api/scan/status` — progress for large scans; UI can show a spinner.
- UI smart updates:
  - On Smart Album Load: compute signature; if unchanged → skip scan; else trigger `POST /api/scan` with `mode:'auto'` and wait for completion events before aggregations.
  - On Update button: overwrite the selected album JSON with current roots + filter chain; no rescan implied.

### Aggregations and refresh cycle

- On any filter change or album Load:

1) POST `/api/files/search` with current FilterChain → returns matching file IDs and page.

2) GET `/api/tags/aggregate?scope=selection` → counts within selection.

3) GET `/api/tags/aggregate?scope=source` → counts across current sources.

4) UI sets active view to Statistics; updates Selection and Library panes accordingly.

- Debounce queries (150–250 ms) and cancel in-flight requests.

### API

- Albums (file-based): `GET /api/albums`, `GET /api/albums/:id`, `POST /api/albums`, `PUT /api/albums/:id`, `DELETE /api/albums/:id`
- Files/search: `POST /api/files/search` { filter, sort?, page? }
- Tags CRUD: `GET /api/tags`, `POST /api/tags`
- Tag application: `POST /api/files/:id/tags`, `POST /api/files/tags`
- Tag groups: `GET /api/tag-groups`, `POST /api/tag-groups`, items add/remove
- Placeholder expansion: `POST /api/expand-placeholder`
- Sync: `POST /api/sync`
- Tutorials: `GET /api/tutorials`, `GET /api/tutorials/:id`
- UI state: `GET /api/state`, `PUT /api/state`
- I18n: `GET /i18n/:lang/ui.json`
- Aggregations: `GET /api/tags/aggregate?scope=selection|source`
- Scanning: `POST /api/scan`, `GET /api/scan/status`

### Frontend modules

- `modules/filter/` — FilterBuilder, FilterNodeView, ConnectorSelect, `useFilterChain`
- `modules/tags/` — TagLibraryTabs, PlaceholderList, UserTagList, GroupTabView
- `modules/albums/` — AlbumTree/List, Load/Update/Add/Delete actions
- `modules/stats/` — Statistics view bound to latest aggregations
- `state/refresh.ts` — orchestrates the refresh cycle; consults `scan/status` and signature comparison before querying

### Interactive tutorials

- Scripts in `tutorials/*.json`; include steps for loading an album with same/different sources to observe fast/slow paths and for clicking Update to persist the current state.

### Portable app behavior

- App serves at `http://127.0.0.1:5000/`; bundle ExifTool, DB, ui-state, i18n, and `data/albums/*`.

### Key files to create (delta)

- `server/src/routes/albums.ts` (file-backed JSON CRUD)
- `server/src/routes/aggregations.ts` (selection and source tag counts)
- `server/src/routes/scan.ts` (incremental scanning + status)
- `server/src/services/queryBuilder.ts` (CTE-based evaluator)
- `server/src/services/scanner.ts` (dir walker, signature, incremental logic)
- `packages/shared/filters.ts` (Zod schema)
- `web/src/modules/albums/AlbumsPanel.tsx`
- `web/src/state/refresh.ts` (central refresh orchestration)

### Non-obvious decisions

- Source-set signatures let us skip redundant scans reliably; deltas keep big collections responsive.
- We avoid heavy persistent caches for aggregations; SQLite with proper indexes is fast and correct.
- All disk writes (albums, state) are atomic with rotating backups.

### Foundations (cross-cutting)

- AtomicJsonStore utility used by UI state and album JSON
- Logger setup (pino) and error code catalog
- Result<T, E> helper for service layers and error propagation
- App event bus (typed) for `selectionChanged`, `filtersChanged`, `albumLoaded`
- Data migrations policy for UI state and DB

### Testing strategy and budgets

- Property-based tests for date/location resolvers
- Contract tests (OpenAPI typed client once available)
- Large-data smoke (50k synthetic files) in nightly CI (later)
- Performance budgets: search < 150ms @10k files; first thumbnail < 500ms

### To-dos

- [x] Initialize Node+TS monorepo, linting, tsconfig paths, pnpm or npm workspaces
- [x] Create Express server, health route, static web serving
- [ ] Add Drizzle schema and migrations for files, tags
- [ ] Implement stay-open ExifTool service with read/write helpers
- [ ] Implement incremental scanner with source signatures and status endpoint
- [ ] Directory scan endpoint and file indexing into DB
- [ ] CRUD APIs for files, tags, file_tags; thumbnail generation
- [ ] Implement aggregations endpoints for selection and source
- [ ] Sync endpoint implementing add/overwrite between exif/xmp/db
- [ ] Implement FilterChain schema and query builder
- [ ] Build FilterBuilder UI with dynamic connectors and pruning
- [ ] Implement file-backed smart albums and API (Load/Update/Add/Delete)
- [ ] Build Albums panel UI and wire refresh cycle (auto switch to Statistics, refresh panes)
- [ ] Implement tag groups tables and API (incl. items add/remove)
- [ ] Build TagLibrary tabs UI and context menus with delete semantics
- [ ] Implement placeholder resolver (date + location) and offline geocoder
- [ ] Implement UI state persistence (schema, GET/PUT, hydrate/persist with debounce and backups)
- [ ] Implement i18n matrix and contextual help (Tooltip, HelpMode, DocPopover, data-uiid, CI coverage)
- [ ] Scaffold Vite React app with routing, Zustand, Tailwind
- [ ] Create packages/ui with atomic components (Button, TagPill, SplitPane, Tabs, etc.)
- [ ] Build and test each UI component in Storybook first ("button zoo")
- [ ] Configure Storybook for packages/ui with MSW and docs
- [ ] Add in-app /zoo with fixtures to demo composite flows and DnD
- [ ] Implement TagLibrary→Selection and filter node DnD via dnd-kit
- [ ] Tutorials: define shared schema, build TutorialRunner and tutorials route, implement Playwright adapter
- [ ] Bundle server, web build, ExifTool, DB into portable folder

### Workpackages: Phase 1 (granular)

1) Initialize Node+TS monorepo, linting, tsconfig paths, workspaces
- [x] Create `package.json` with workspaces (`packages/*`, `server`, `web`) and scripts: `lint`, `type-check`, `depcruise`
- [x] Add `pnpm-workspace.yaml` (or npm workspaces) and lockfile
- [x] Add `tsconfig.base.json` with path aliases for `@shared/*` and strict options
- [x] Create minimal `packages/shared/` with tsconfig and a sample type to validate path mapping
- [x] Wire ESLint to TypeScript (uses `.eslintrc.cjs`), add `lint` script; ensure it runs
- [x] Add `depcruise` script and run against an empty structure (should pass)
- Acceptance: `npm run lint` passes; `npx depcruise` passes; `tsc -p tsconfig.base.json --noEmit` passes

2) Server bootstrap: Express, health route, static serving
- [x] Scaffold `server/` workspace: `package.json`, `tsconfig.json` (extends base; path aliases for `@shared/*`)
- [x] Define shared contract: `packages/shared/src/contracts/health.ts` (Zod `HealthResponse`), export via `packages/shared/src/index.ts`
- [x] Implement Express app split: `server/src/app.ts` (createApp) and `server/src/index.ts` (boot)
- [x] Add `server/src/routes/health.ts` with `GET /api/health` returning `HealthResponse`
- [x] Configure static serving of `web/dist` when present; return 404 JSON for unknown API routes
- [x] Add `server/src/logger.ts` (pino) and use it in `index.ts`; no `console.*`
- [x] Add error-handling middleware with typed error envelope (align with Rules)
- [x] Tests: `server/test/health.test.ts` using supertest against `createApp()`
- [x] Scripts (server): `dev` (tsx), `build` (tsc), `start` (node dist), `test` (vitest)
- [x] Scripts (root): `server:dev`, `server:build`, `server:start`, `server:test`
– Acceptance: lint + type-check pass; tests green; `curl http://127.0.0.1:5000/api/health` → 200 with schema-valid JSON; static files served if `web/dist` exists

3) Database: Drizzle + better-sqlite3, schemas, migrations, and tests
- [x] Shared DB row schemas (Zod) in `packages/shared/src/db/` and exported via `packages/shared/src/index.ts`
  - Files, Tags, FileTags schemas and derived types
  - Acceptance: unit tests parse a valid and an invalid row per entity
- [x] Install Drizzle, better-sqlite3, and CLI; add `server/drizzle.config.ts`
  - Scripts in `server/package.json`: `db:generate`, `db:migrate`, `db:studio` (optional)
  - Acceptance: `npm run -w server db:generate` produces migrations
- [x] Define Drizzle tables with keys and indices
  - `files`: `id PK`, `path UNIQUE`, `dir`, `name`, `ext`, `size`, `mtime`, `ctime`, `width`, `height`, `duration`, `lat`, `lon`, `taken_at`, `xmp_path NULL`, `xmp_mtime NULL`, `last_indexed_at`; indices on `dir`, `(ext,name)`
  - `tags`: `id PK`, `name`, `slug UNIQUE`, `color`, `group`, `parent_id NULL`, `source ENUM('user','auto')`
  - `file_tags`: `(file_id, tag_id) PK`, FKs with `ON DELETE CASCADE`; index `(tag_id, file_id)`
  - Acceptance: generated SQL includes FKs/indices/uniques as above
- [x] DB path/config and `data/` directory handling
  - `server/src/db/config.ts` reads env for `DB_FILE_PATH` or defaults to `data/phoTool.db`; ensures `data/` exists
  - Acceptance: after migrate, `data/phoTool.db` exists on disk
- [x] Migration runner and DB client
  - `server/src/db/migrate.ts` applies migrations using better-sqlite3 + Drizzle migrator
  - `server/src/db/client.ts` exports a singleton Drizzle client
  - Acceptance: `npm run -w server db:migrate` succeeds on a fresh repo
- [x] Smoke query util
  - `server/src/db/smoke.ts` runs a simple query and logs via `server/src/logger.ts`
  - Acceptance: running the compiled script reports success
- [x] Unit tests with isolated DB
  - Helper to create an in-memory or temp-file SQLite DB and apply migrations in tests
  - Tests: insert file, tag, link in `file_tags`; FK integrity (cascade), unique `tags.slug`
  - Acceptance: tests pass locally and in CI
- [x] CI integration
  - Update CI to run `npm run -w server db:migrate` before server tests
  - Acceptance: CI green with migrations applied

4) ExifTool service (stay-open) with read/write helpers
- [x] Define shared port and schemas: `packages/shared/src/ports/exiftool.ts` (Zod)
- [x] ADR: Exif/XMP policy (sidecar-first, embedded opt-in, delimiter conventions)
- [x] Install `exiftool-vendored`; scaffold `server/src/services/exiftool/index.ts`
- [x] Implement start/stop lifecycle; bounded queue and concurrency cap (configurable)
- [x] Add command timeout (configurable)
- [x] Enforce ExifTool argument allowlist and path normalization
- [x] Implement `readMetadata(filePath)` → typed minimal fields (subjects, hierarchicalSubjects, takenAt, lat, lon, width, height, duration)
- [x] Implement `writeSubjects(filePath, subjects: string[])` to `dc:Subject` (sidecar-only)
- [x] Implement `writeHierarchicalSubjects(filePath, paths: string[][])` to `lr:HierarchicalSubject` ("|"-delimited levels, sidecar-only)
- [x] Add pure mapping utils between DB tags and XMP subjects/hierarchical tokens
- [x] Unit tests mocking the exiftool process (CI-safe)
- Acceptance: mapping and service tests (mocked) green; allowlist/timeout/concurrency covered; optional local smoke succeeds

### Workpackages: Phase 2 — Incremental scanner and scan API

- [x] Shared contracts and port
  - `packages/shared/src/ports/scanner.ts`: Zod schemas for `ScanMode`, `ScanRequest`, `ScanId`, `ScanStatus`, `ScanResult`; export `ScannerPort`.
  - Export via `packages/shared/src/index.ts`.
- [x] DB support for source signatures
  - Add `server/src/db/schema/sources.ts` table: `id`, `signature UNIQUE`, `roots_json`, `last_scanned_at`.
  - Export from `server/src/db/schema/index.ts`; migration generated in follow-up.
- [x] Pure FS-diff utilities (no DB writes)
  - `server/src/services/scanner/fs.ts`: `normalizePaths`, `computeSignature`, `listFiles`, `diffAgainstDb` (adds/updates/deletes using `path`/`xmp_mtime`).
  - Tests with `mock-fs`: add/update/delete, sidecar-only change, unchanged fast path.
- [x] Scanner service (DB-apply layer)
  - `server/src/services/scanner/index.ts`: apply diff to `files` table; maintain tombstones for deletes; update `sources` by signature; skip when `mode='auto'` and unchanged.
  - Uses injected DB client and `logger`; no ExifTool reads in this phase.
- [x] In-memory job queue and status tracking
  - Single-flight queue; `ScanStatus` exposes `queued|running|completed|failed`, `scanned/total`, timestamps, error.
- [x] HTTP routes (adapter)
  - `server/src/routes/scan.ts`: `POST /api/scan` (start) and `GET /api/scan/status` (poll). Validate with shared Zod.
  - Wire into `server/src/app.ts`.
- [x] Config surface
  - Extend `packages/shared/src/config.ts` with `scanner` defaults: `followSymlinks`, `ignoreGlobs[]`, `extensions[]`, `concurrency`, `statusRetentionMs`.
- Acceptance: `POST /api/scan` enqueues and returns `scanId`; `GET /api/scan/status` reports progress; auto-mode skips unchanged signatures; DB reflects adds/updates/deletes on fixtures; unit tests for FS-diff and routes pass.

### Workpackages: Phase 3 — Search, thumbnails, and aggregations

- [x] Shared schemas and ports
  - Add `packages/shared/src/filters.ts` (Zod `FilterChain`, `FilterNode`, `Connector`, `NodeMode`)
  - Add `packages/shared/src/contracts/search.ts`, `aggregations.ts`, `thumbnails.ts`
  - Add ports: `packages/shared/src/ports/query.ts`, `aggregations.ts`, `thumbnails.ts`
- [x] Query builder (pure) in `server/src/services/queryBuilder.ts`
  - Node SQL (any/all) and CTE combination (INTERSECT/UNION/EXCEPT); parameterized
- [x] DB indexes for search/sort (migration)
  - Index `files.taken_at` (and consider `files.mtime`, `files.size`) for perf budgets
- [x] Query execution service in `server/src/services/query.ts`
  - Execute `FilterChain` with paging/sort; return ids + lightweight fields
- [x] `POST /api/files/search` route
  - Validate with shared schemas; wire into `app.ts`
- [x] Thumbnails service `server/src/services/thumbnails.ts` using `sharp`
  - Disk cache by `file_id + mtime + size + format`; config in shared `config.ts`
- [x] `GET /api/files/:id/thumbnail` route
  - Validate query (`size`, `format`); serve cached bytes with headers
- [x] Aggregations service `server/src/services/aggregations.ts`
  - Selection via `FilterChain`; Source via roots/signature; SQL grouping
- [x] `POST /api/tags/aggregate` route
  - Body `{ scope, filter?, roots? }`; returns counts; validate with shared schema
- [x] Tests
  - Query builder unit tests; service tests (query/aggregations); route tests (search/thumbnail/aggregate)
  - Thumbnail cache invalidation on `mtime` change; output dimensions/format
- [x] Acceptance: search returns expected ids; thumbnails cached; aggregates correct on fixtures; coarse perf within budgets

### Workpackages: Phase 4 — Tags, groups, and application semantics

- [x] Shared contracts and ports (packages/shared)
  - Zod schemas: Tag CRUD, Tag Groups, Tag Application (`mode: 'add'|'remove'|'set'`)
  - Ports: `TagsPort`, `TagGroupsPort`, `TagApplicationPort`
- [x] DB schema and migrations for groups
  - Tables: `tag_groups(id, name)`, `tag_group_items(group_id, tag_id)` with FKs and uniques
- [x] Routes mount adjustment (avoid collisions)
  - Move aggregations under `/api/aggregations` (keep `/api/tags/aggregate` alias temporarily)
  - Document via ADR-0002; update plan references
- [x] Tag CRUD (service + routes)
  - `GET /api/tags`, `POST /api/tags` (create), `PUT /api/tags/:id` (rename/color)
- [x] Tag Groups CRUD and membership (service + routes)
  - `GET /api/tag-groups`, `POST /api/tag-groups`
  - `POST /api/tag-groups/:id/items` (add/remove tag ids)
- [x] File tag application (service + routes)
  - `POST /api/files/:id/tags` (single)
  - `POST /api/files/tags` (batch) with `mode: add|remove|set`
- [x] Library delete semantics
  - Implement group unlink (does not delete tag entity)
  - Implement selection removal by explicit ids or resolved from a FilterChain
- [x] Logging, validation, typed errors
  - Use shared schemas for validation; no ad-hoc DTOs; no `console.*`
- [x] Tests (unit + route)
  - Cover CRUD, group membership, apply/remove/set, and delete semantics
- Acceptance: migrations apply cleanly; APIs match Rules; tests green

### Workpackages: Phase 5 — Placeholder resolver and offline geocoder

1) Shared contracts and port
- [x] Add `packages/shared/src/contracts/placeholders.ts` (Zod): `PlaceholderToken = 'year'|'month'|'day'|'weekday'|'country'|'state'|'city'`; `ExpandPlaceholderRequest { fileIds: number[]; tokens: PlaceholderToken[] }`; `ExpandPlaceholderResponse { expansions: Record<number, string[]> }`
- [x] Add `packages/shared/src/ports/placeholders.ts` exposing `PlaceholderResolverPort.expand(req)`
- Acceptance: contracts exported via `packages/shared/src/index.ts`; schema round-trips in a unit test

2) ADR: offline geocoder scope and cache policy
- [x] Create `docs/adr/ADR-0003-placeholder-geocoder.md` covering dataset choice (builtin country polygons + optional GeoNames), precision policy (geohash length or decimal rounding), cache keying, and canonical tag name/slug formatting
- Acceptance: ADR merged and referenced by resolver PRs

3) DB schema for geocode cache
- [x] Add `server/src/db/schema/geoCache.ts` and migration with fields `{ lat_rounded, lon_rounded, precision, country, state, city, source, updated_at }` and unique index on `(lat_rounded, lon_rounded, precision)`
- Acceptance: migration applies; unique/indexes present in generated SQL

4) Pure date resolver utility
- [x] Add `server/src/services/placeholders/date.ts` (pure): derive `year`, `month (YYYY-MM)`, `day (YYYY-MM-DD)`, `weekday` from `files.taken_at`; locale-independent, UTC-safe; missing `taken_at` yields no expansions
- [x] Tests: property/edge cases for boundaries and timezones
- Acceptance: tests green; no I/O

5) EXIF textual location extractor utility
- [x] Add `server/src/services/placeholders/locationFromExif.ts` (pure): normalize EXIF textual fields to `{ country, state, city }`
- [x] Tests: fixtures for mapping and missing fields
- Acceptance: tests green; no I/O

6) Offline geocoder adapter + datasets + cache layer
- [ ] Data prep script: `scripts/fetch-geodata.ts` downloads/updates datasets under `data/geodata/` (Natural Earth admin-0; optional GeoNames cities/admin codes)
- [ ] Preprocess: simplify country polygons to TopoJSON; build R-tree index for bbox prefilter; KD-tree for GeoNames nearest-city lookup
- [x] Add `server/src/services/placeholders/offlineGeocoder.ts`: given `lat/lon` → apply precision → cache lookup → country via polygon → city/state via GeoNames (if enabled) → write-through cache
- [x] Extend `packages/shared/src/config.ts` with `geocoder` settings: `enabled`, `precision`, `datasets.countryPolygons`, `datasets.geoNames`
- [ ] Licensing docs: add attribution for GeoNames; list dataset versions in `docs/adr/ADR-0003-placeholder-geocoder.md`
- [ ] Tests: known coords resolve deterministic country; city/state when datasets enabled; second call hits cache; dataset disabled path returns undefined
- Acceptance: unit tests cover cache hit/miss, configuration flags, and deterministic outputs

7) PlaceholderResolver service (port adapter)
- [x] Add `server/src/services/placeholders/index.ts`: compose date resolver, EXIF extractor, and offline geocoder; precedence `EXIF text → offline geocoder`; format canonical tag labels/slugs per ADR
- [ ] Logging and typed errors per Rules; no `console.*`
- [x] Tests: in-memory DB verifies precedence and caching behavior
- Acceptance: tests green; strict types enforced

8) HTTP route
- [x] Add `server/src/routes/placeholders.ts`: `POST /api/expand-placeholder` validating with shared Zod; limit `fileIds` length; wire into `app.ts`
- [x] Route tests with supertest: validation errors, happy path, large input rejection
- Acceptance: route tests green; response matches shared contract

9) Performance and determinism smoke
- [x] Local bench for ~1k expansions: first vs cached run; assert stable output formatting
- Acceptance: cached run materially faster; outputs match golden samples

10) Documentation and plan updates
- [x] Update this plan and link the ADR; ensure acceptance checks are listed
- Acceptance: plan updated; pre-commit/pre-push gates pass

11) Optional online geocoding fallback (dev-only)
- [ ] Config flag `geocoder.online.enabled` (default false) and rate-limit settings
- [ ] Implement `server/src/services/placeholders/onlineGeocoder.ts` calling Nominatim with custom User-Agent and backoff; disabled in portable builds and CI by default
- [ ] Tests: MSW-stubbed responses for a few coords; 429/backoff behavior; disabled path returns undefined
- Acceptance: online fallback only used when explicitly enabled; tests use mocks only; no network in CI

12) Phase 5 test coverage hardening
- [x] Shared contracts: add `shared.placeholders.contract.test.ts` with valid/invalid round-trips
- [x] Config: extend `config.test.ts` to cover `geocoder` defaults and overrides
- [x] DB migration: add assertion that `geo_cache` table and unique index exist
- [x] Service precedence: seed in-memory DB to verify `EXIF text → offline` order and token filtering
- [x] Routes: expand supertest coverage (valid body → 200 shape; invalid tokens → 400; >1000 ids → 413)
- [x] Determinism: stabilize and assert repeatability of outputs across two runs; keep perf checks non-timing-based
- Acceptance: all new tests green locally; coverage includes contracts, config, DB presence, service precedence, route validation, and determinism

### Workpackages: Phase 6 — Web scaffold and state foundation

- [ ] Scaffold Vite React app (`web/`) with TanStack Router, Zustand, Tailwind
- [ ] Create `state/` slices (selection, filters, tags, layout, prefs)
- [ ] Integrate API client typed from shared types
- [ ] Smoke route renders app shell
- Acceptance: `web` dev server runs; basic navigation works

### Workpackages: Phase 7 — FilterBuilder UI and DnD to nodes

- [ ] `modules/filter/FilterBuilder` with Starting Node + dynamic connectors (and|or|and not|none)
- [ ] `FilterNodeView` with mode any/all and tag chips; drop target for TagPills/placeholders (expand on drop)
- [ ] Connector changes create/prune nodes as specified
- [ ] Stories cover empty, one-node, multi-node, pruning, keyboard Delete in node
- Acceptance: stories pass; node chain behaves per spec

### Workpackages: Phase 8 — TagLibrary UI (tabs, groups, context menus)

- [ ] Tabs: Automatic, User Defined, plus dynamic user groups
- [ ] `PlaceholderList` draggables; `UserTagList` with search and context menu; `GroupTabView`
- [ ] Keyboard Delete and context actions per three-context rules
- [ ] Stories for each tab state and context menu flows
- Acceptance: stories and component tests validate actions and focus/keyboard behavior

### Workpackages: Phase 9 — Placeholder to Selection and file apply flows

- [ ] Implement Selection panel and DnD from TagLibrary (store placeholder tokens in UI)
- [ ] Batch apply/remove selected tags to files via API; progress/toasts
- [ ] Stories for selection list and DnD; tests for apply/remove payloads
- Acceptance: selection updates reflected via API; tests green

### Workpackages: Phase 10 — UI state persistence

- [ ] Define Zod schema in `packages/shared/uiState.ts` with versioning
- [ ] Server: `GET/PUT /api/state` writes `data/ui-state.json` atomically with rotating backups
- [ ] Client: `persist.ts` subscribes to slices, debounced save; `hydrate.ts` loads + migrations
- [ ] BroadcastChannel to sync tabs; import/export/reset actions
- Acceptance: reload restores layout, filters, sources; backups rotate; tabs stay in sync

### Workpackages: Phase 11 — i18n matrix and contextual help

- [ ] Create `i18n/en/ui.json` and `i18n/de/ui.json`; loader and `useI18n(uiId)` hook
- [ ] Tooltip for `hint`; Help-mode toggle (`?`) with custom cursor and `DocPopover` for `doc`
- [ ] Script to verify all `data-uiid` exist in all languages
- [ ] Stories show RTL and language swap; tests verify text resolutions
- Acceptance: coverage script passes; help-mode suppresses clicks and shows docs

### Workpackages: Phase 12 — Smart Albums (file JSON) and refresh cycle

- [ ] CRUD endpoints over `data/albums/*.json` (atomic write + backup)
- [ ] Albums panel UI (Load/Update/Add/Delete)
- [ ] On Load or filter change: orchestrate search → aggregates; auto-switch to Statistics; refresh panes
- [ ] Signature check skips scan when sources unchanged; otherwise `scan auto`
- Acceptance: loading albums reconstructs UI; unchanged sources avoid re-scan; panes refresh

### Workpackages: Phase 13 — Tutorials and Playwright adapter

- [ ] Define `packages/shared/tutorial.ts` schema and JSON examples
- [ ] In-app `TutorialRunner` and tutorials route (left list + app canvas)
- [ ] Playwright adapter executes the same scripts for CI
- [ ] Scripts for core flows: placeholder to selection, filter chain, album load, delete semantics
- Acceptance: tutorial scripts run in-app and headless; CI smoke passes

### Workpackages: Phase 14 — Packaging (portable build)

- [ ] Build web (`web/dist`) and server (`server/dist`); include ExifTool binary and `data/`
- [ ] Package with `pkg`/`nexe` into a portable folder; start server at 127.0.0.1:5000 and open browser
- [ ] Smoke test portable on Windows; read/write to `data/` works
- Acceptance: a single folder runs the app; healthcheck and basic flows work
