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
- **Help System**: When help mode is active, cursor changes to "?" and hovering over UI elements shows comprehensive help text (`doc`) instead of brief hints (`hint`).
- **Help Mode Toggle**: Click "?" button or press ESC to exit help mode; visual indicator shows when help mode is active.

### Tag Library: tabs, placeholders, groups, and deletion semantics

- Tabs: `Automatic`, `User Defined` (built-in group), plus user-created groups.
- `Automatic` shows placeholder tags: `Year`, `Month`, `Day`, `Weekday`, `Country`, `State`, `City`.
- Placeholders are tokens until applied; concrete tags (e.g., `Year 2025`) are lazily created with `source='auto'`.
- `User Defined` content reflects all tags available in any file under the current source directories, plus manually created tags (even if 0 usage). Counts are shown; search and context menus apply as specified.
- Delete semantics (keyboard Del or context menu): (1) Filter Node → remove from that node only. (2) Tags → Selection → remove from selected pictures (DB + XMP/EXIF sync queue). (3) Tags → Library → unlink from current Library group and remove from currently selected pictures; tag entity remains unless explicit "Delete tag everywhere".

### TagPill Component Specifications

- **Color Management**: Each tag gets a unique color assigned automatically; users can change colors via context menu.
- **Multi-Selection**: Support for Shift+Click and Ctrl+Click selection patterns.
- **Drag and Drop**: Tags can be dragged from Library to Selection and FilterBuilder nodes.
- **Sorting**: Tags can be sorted alphabetically (up/down) or by usage (most/least).
- **Context Menus**: Right-click context menu with options:
  - **Delete**: Remove tag from Library (permanent deletion)
  - **Remove**: Remove tag from Selection or FilterBuilder nodes
  - **Change Color**: Open color picker to change tag color
- **Add Tag**: "Add Tag" button in Library creates new tags with unique colors.
- **Visual States**: Selected, hover, drag, and disabled states with appropriate visual feedback.

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
- **Tutorials System**: Interactive learning interface with two-column layout (20% tutorial list, 80% full GUI)
- **Tutorials Button**: Located in top-left frame, opens tutorials in new tab
- **Step-by-Step Guidance**: Playwright-powered tutorials with UI element highlighting and explanatory text
- **Tutorial i18n Matrix**: Separate internationalization system for tutorial content
- **Tutorial Scripts**: JSON/TS scripts for core workflows (navigation, tagging, filtering, albums, sync)

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
- [x] ES module imports for schema files
  - Fixed relative imports in schema files to include `.js` extension for Node.js ES module compatibility
  - Acceptance: server starts without module resolution errors; all tests pass

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

### Workpackages: Phase 5 — Placeholder resolver and online geocoder

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

6) Online geocoder adapter (BigDataCloud) + cache layer
- [x] Add `server/src/services/placeholders/bigdatacloudGeocoder.ts`: given `lat/lon` → apply precision → cache lookup → BigDataCloud API → write-through cache
- [x] Extend `packages/shared/src/config.ts` with `geocoder` settings: `enabled`, `precision`, `bigdatacloud.baseUrl`, `bigdatacloud.timeoutMs`, `bigdatacloud.retries`
- [x] No API key or rate limiting required (Fair Use Policy)
- [x] Tests: known coords resolve deterministic country/city/state; second call hits cache; API failure path returns undefined
- Acceptance: unit tests cover cache hit/miss, configuration flags, retry logic, and deterministic outputs

7) PlaceholderResolver service (port adapter)
- [x] Add `server/src/services/placeholders/index.ts`: compose date resolver, EXIF extractor, and BigDataCloud geocoder; precedence `EXIF text → BigDataCloud geocoder`; format canonical tag labels/slugs per ADR
- [x] Logging and typed errors per Rules; no `console.*`
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

11) Online geocoding implementation (BigDataCloud)
- [x] Using BigDataCloud as primary geocoder (no API key, Fair Use Policy, administrative-level accuracy)
- [x] Config includes `geocoder.enabled` (default true) and retry/timeout settings
- [x] Implement `server/src/services/placeholders/bigdatacloudGeocoder.ts` with retry logic and cache integration
- [x] Tests: MSW-stubbed responses for coords; retry/timeout behavior; network failure returns undefined
- Acceptance: geocoder works out-of-box; tests use mocks only; no network in CI

12) Phase 5 test coverage hardening
- [x] Shared contracts: add `shared.placeholders.contract.test.ts` with valid/invalid round-trips
- [x] Config: extend `config.test.ts` to cover `geocoder` defaults and overrides
- [x] DB migration: add assertion that `geo_cache` table and unique index exist
- [x] Service precedence: seed in-memory DB to verify `EXIF text → BigDataCloud` order and token filtering
- [x] Routes: expand supertest coverage (valid body → 200 shape; invalid tokens → 400; >1000 ids → 413)
- [x] Determinism: stabilize and assert repeatability of outputs across two runs; keep perf checks non-timing-based
- [x] Cache behavior: comprehensive tests for cache hit/miss, coordinate rounding, precision handling, and negative coordinates
- Acceptance: all new tests green locally; coverage includes contracts, config, DB presence, service precedence, route validation, determinism, and cache behavior

### Workpackages: Phase 6 — State contracts, API client foundation, and UI state schema (UI-independent)

**1) Shared UI state contracts and schemas**
- [x] Define `packages/shared/src/uiState.ts`: Zod schemas for UI persistence
  - `UiStateSchema` with versioning (`version`, `currentVersion`, `migrations`)
  - Slices: `SelectionState`, `FilterState`, `LayoutState`, `PreferencesState`
  - `SelectionState`: `{ selectedFileIds: number[]; lastSelectedId: number | null }`
  - `FilterState`: `{ activeChain: FilterChain; history: FilterChain[] }`
  - `LayoutState`: `{ activeView: 'list'|'grid'|'map'|'stats'; panelSizes: Record<string, number>; panelCollapsed: Record<string, boolean>; helpMode: boolean }`
- `TagState`: `{ selectedTagIds: string[]; tagSortBy: 'name'|'usage'; tagSortOrder: 'asc'|'desc'; tagColors: Record<string, string> }`
- `TutorialState`: `{ currentTutorial: string | null; currentStep: number; completedTutorials: string[]; tutorialProgress: Record<string, number> }`
- `PreferencesState`: `{ locale: string; theme: 'light'|'dark'|'auto' }`
- [x] Add `packages/shared/src/ports/uiState.ts`: `UiStatePort` interface
  - Methods: `get()`, `update(partial)`, `reset()`
- [x] Export via `packages/shared/src/index.ts`
- [x] Unit tests: `server/test/shared.uiState.contract.test.ts` (valid/invalid schemas, version migration structure)
- **Acceptance**: Schemas parse valid states; invalid states rejected; tests green; exported from shared index

**2) API client types and error contracts**
- [x] Define `packages/shared/src/api/client.ts`: typed fetch wrapper interfaces
  - `ApiClient` interface with methods matching existing endpoints
  - `ApiError` schema (Zod): `{ status: number; code: string; message: string; details?: unknown }`
  - `ApiResponse<T>` type: `{ ok: true; data: T } | { ok: false; error: ApiError }`
- [x] Add `packages/shared/src/api/endpoints.ts`: endpoint path constants
  - Maps all existing routes: health, scan, files, tags, aggregations, etc.
- [x] Export via `packages/shared/src/index.ts`
- [x] Unit tests: `server/test/shared.api.contract.test.ts` (error schema validation, endpoint constant completeness)
- **Acceptance**: Error schema validates; endpoint constants type-safe; tests green

**3) Albums file-backed JSON contracts (server-side, no UI)**
- [x] Define `packages/shared/src/contracts/albums.ts`: Zod schemas
  - `SmartAlbumSchema`: `{ version: 1; name: string; sources: string[]; filter: FilterChain }`
  - `AlbumListResponse`, `AlbumDetailResponse`, `CreateAlbumRequest`, `UpdateAlbumRequest`
- [x] Add `packages/shared/src/ports/albums.ts`: `AlbumsPort` interface
  - Methods: `list()`, `get(id)`, `create(req)`, `update(id, req)`, `delete(id)`
- [x] Export via `packages/shared/src/index.ts`
- [x] Unit tests: `server/test/shared.albums.contract.test.ts` (valid/invalid schemas)
- **Acceptance**: Album schemas parse valid JSON; invalid rejected; tests green

**3.1) Comprehensive test coverage for shared contracts**
- [x] Integration tests: `server/test/shared.integration.test.ts` (10 tests)
  - Cross-module interactions between UI State, API Error, and Albums contracts
  - Schema evolution and versioning across modules
  - Error handling integration between modules
- [x] Error simulation tests: `server/test/shared.error-simulation.test.ts` (14 tests)
  - Malformed data handling and rejection
  - Network errors (timeouts, connection failures)
  - Concurrent access simulation
  - File system errors and corruption scenarios
  - Large dataset handling and memory usage
- [x] Performance benchmark tests: `server/test/shared.performance.test.ts` (10 tests)
  - Schema parsing performance benchmarks (<1ms per iteration)
  - Large dataset handling (10k+ items efficiently)
  - Memory usage validation (no significant leaks)
  - Concurrent operations stability under load
- [x] Updated pre-commit checklist in `docs/Rules.md` to include new test files
- [x] Fixed CI performance test threshold (adjusted from 10ms to 20ms for CI environments)
- **Acceptance**: All 193 tests passing; comprehensive coverage of valid/invalid data, error scenarios, performance benchmarks, and integration testing

**4) Albums service (file-backed JSON CRUD, server-side)**
- [x] Implement `server/src/services/albums.ts`: file-based storage in `data/albums/*.json`
  - Atomic write with rotating backups (reuse pattern from upcoming UI state)
  - List, get, create (with unique ID generation), update, delete
  - Signature computation for `sources[]` (reuse from scanner)
- [x] Implement `server/src/utils/atomicJsonStore.ts`: utility for atomic JSON file operations
  - Atomic writes with temporary files and atomic moves
  - Rotating backups (.bak.1, .bak.2, etc.)
  - Error handling and cleanup
- [x] Unit tests: `server/test/albums.service.test.ts` (CRUD, atomic writes, signature handling)
- [x] Logging with typed errors; no `console.*`
- **Acceptance**: CRUD operations work; atomic writes verified; signatures computed correctly; tests green

**5) Albums HTTP routes (server-side API)**
- [x] Implement `server/src/routes/albums.ts`: 
  - `GET /api/albums` → list all albums
  - `GET /api/albums/:id` → get single album
  - `POST /api/albums` → create album (validate with shared schema)
  - `PUT /api/albums/:id` → update album
  - `DELETE /api/albums/:id` → delete album
- [x] Wire into `server/src/app.ts`
- [x] Route tests: `server/test/albums.routes.test.ts` (supertest covering happy paths, validation errors, 404s)
- **Acceptance**: All routes respond correctly; validation enforced; tests green; aligned with shared contracts

**6) UI state persistence API (server-side)**
- [x] Implement `server/src/services/uiState.ts`: manages `data/ui-state.json`
  - Atomic write with rotating backups (`.bak.1`, `.bak.2`)
  - Read with schema validation and migration support (placeholder for now)
  - Default state generation if file missing
- [x] Unit tests: `server/test/uiState.service.test.ts` (read/write, backups, defaults, migration placeholder)
- [x] Logging with typed errors; no `console.*`
- **Acceptance**: Atomic writes work; backups rotate; defaults correct; tests green

**7) UI state HTTP routes (server-side API)**
- [x] Implement `server/src/routes/uiState.ts`:
  - `GET /api/state` → current UI state
  - `PUT /api/state` → update UI state (validate with shared schema)
- [x] Wire into `server/src/app.ts`
- [x] Route tests: `server/test/uiState.routes.test.ts` (supertest for GET/PUT, validation)
- **Acceptance**: Routes work; validation enforced; tests green

**8) i18n text matrix schema (contracts only, no implementation)**
- [x] Define `packages/shared/src/i18n/schema.ts`: Zod schemas
  - `I18nTextSchema`: `{ label: string; hint?: string; doc?: string }`
  - `I18nFileSchema`: `Record<UIElementId, I18nTextSchema>`
  - Language codes enum: `'en' | 'de'`
- [x] Add `packages/shared/src/ports/i18n.ts`: `I18nPort` interface
  - Methods: `loadLanguage(lang)`, `getText(uiId, lang)`
- [x] Export via `packages/shared/src/index.ts`
- [x] Unit tests: `server/test/shared.i18n.schema.test.ts` (valid/invalid text objects)
- **Acceptance**: Schemas validate i18n JSON structure; tests green

**9) Shared web build configuration preparation**
- [x] Create `web/` workspace directory structure
  - `web/package.json` with workspace config (no dependencies yet)
  - `web/tsconfig.json` extending `tsconfig.base.json` with path aliases for `@shared/*`
  - `web/.gitignore` (node_modules, dist)
- [x] Verify workspace detection: `npm --workspace @phoTool/web --version` succeeds
- [x] Add placeholder `web/README.md` noting "Web workspace scaffolding - dependencies and Vite setup in Phase 6B"
- **Acceptance**: Workspace recognized; path aliases resolve; no build yet (no dependencies installed)

**10) Rebuild shared package and verify imports**
- [x] Run `npm --workspace @phoTool/shared run build`
- [x] Verify all new exports present in `packages/shared/dist/`
- [x] Ensure full pre-commit checklist from Rules.md passing
- **Acceptance**: All gates pass; new contracts exported and usable; no breaking changes

### Workpackages: Phase 7 — UI development (Test-Driven Development)

**Phase 7 Implementation Priorities** (based on mockup analysis):

1. **TagPill Component** - Critical foundation component for entire UI
2. **FilterBuilder Component** - Most complex component, core functionality
3. **Directory Input Component** - Essential for content loading and validation
4. **SmartAlbums-FilterBuilder Integration** - Critical workflow integration
5. **Status Bar and Progress Indicators** - Essential user feedback
6. **Tutorials System** - Interactive learning and user onboarding
7. **Help System** - Essential for user experience and documentation
8. **Layout System** - 2-row panel structure from mockups
9. **TagLibrary** - Central to user experience with DnD
10. **View Components** - Statistics, List, File, Location views
11. **View Controls** - Selection and navigation controls
12. **DnD Infrastructure** - Enhanced user experience
13. **Sync Panel** - Administrative functionality
14. **File Operations** - Copy/move with database sync
15. **Confirmation Dialogs** - Error handling and user safety

**Phase 7 Granular TODO List** (for immediate implementation with comprehensive testing):

**Phase 7.1: UI Workspace Foundation**
- [ ] **7.1.1**: Create `packages/ui/` workspace with `package.json`, `tsconfig.json`
  - [ ] **Test**: Verify workspace detection and path aliases work
- [ ] **7.1.2**: Set up Storybook configuration with MSW (Mock Service Worker)
  - [ ] **Test**: Storybook builds and runs with empty component library
- [ ] **7.1.3**: Configure Tailwind CSS with design system tokens
  - [ ] **Test**: Tailwind classes compile and apply correctly
- [ ] **7.1.4**: Set up Vitest for component testing
  - [ ] **Test**: Vitest runs and can import React components
- [ ] **7.1.5**: Create atomic component directory structure (`atoms/`, `molecules/`, `organisms/`, `templates/`)
  - [ ] **Test**: Directory structure exists and is accessible
- [ ] **7.1.6**: Implement shared component utilities (`useI18n`, `useTheme`, `useHelpMode`)
  - [ ] **Test**: Utilities can be imported and used in components
  - [ ] **Test**: `useI18n` returns correct text for given `uiId`
  - [ ] **Test**: `useTheme` provides theme context
  - [ ] **Test**: `useHelpMode` toggles help mode state

**Phase 7.2: Foundational Atoms (Test-First Development)**

**Phase 7.2.1: Button Component**
- [ ] **7.2.1.1**: Write Button component tests (rendering, variants, states, i18n, help mode)
- [ ] **7.2.1.2**: Implement Button component with all variants (primary, secondary, ghost, danger)
- [ ] **7.2.1.3**: Add Button sizes (sm, md, lg) and states (disabled, loading)
- [ ] **7.2.1.4**: Implement Button i18n support with `useI18n(uiId)`
- [ ] **7.2.1.5**: Add Button help mode support with `DocPopover`
- [ ] **7.2.1.6**: Create Button Storybook stories (all variants, sizes, states, help mode, i18n swap)
- [ ] **Test**: Button renders with correct variant classes
- [ ] **Test**: Button shows loading state with `aria-busy`
- [ ] **Test**: Button respects disabled state
- [ ] **Test**: Button shows help text in help mode
- [ ] **Test**: Button keyboard navigation (Enter/Space)
- [ ] **Test**: Button accessibility (ARIA roles, focus ring)

**Phase 7.2.2: Input Component**
- [ ] **7.2.2.1**: Write Input component tests (rendering, validation, i18n, help mode)
- [ ] **7.2.2.2**: Implement Input component with validation states (valid, invalid, error)
- [ ] **7.2.2.3**: Add Input i18n support with labels and hints
- [ ] **7.2.2.4**: Implement Input help mode support
- [ ] **7.2.2.5**: Create Input Storybook stories (all states, validation, help mode)
- [ ] **Test**: Input renders with correct validation classes
- [ ] **Test**: Input shows error messages
- [ ] **Test**: Input shows help text in help mode
- [ ] **Test**: Input keyboard navigation and focus management
- [ ] **Test**: Input accessibility (labels, error announcements)

**Phase 7.2.3: Icon Component**
- [ ] **7.2.3.1**: Write Icon component tests (rendering, sizing, theming)
- [ ] **7.2.3.2**: Implement Icon component with SVG system
- [ ] **7.2.3.3**: Add Icon consistent sizing and theming
- [ ] **7.2.3.4**: Create Icon Storybook stories (all icons, sizes, themes)
- [ ] **Test**: Icon renders with correct size classes
- [ ] **Test**: Icon applies theme colors correctly
- [ ] **Test**: Icon accessibility (decorative vs semantic)

**Phase 7.2.4: TagPill Component (Critical Foundation)**
- [ ] **7.2.4.1**: Write TagPill component tests (rendering, variants, selection, DnD, context menu)
- [ ] **7.2.4.2**: Implement TagPill basic rendering with color and text
- [ ] **7.2.4.3**: Add TagPill variants (library, selection, filter)
- [ ] **7.2.4.4**: Implement TagPill selection state with visual feedback
- [ ] **7.2.4.5**: Add TagPill multi-selection (Shift+Click, Ctrl+Click)
- [ ] **7.2.4.6**: Implement TagPill context menu (Delete/Remove/Change Color)
- [ ] **7.2.4.7**: Add TagPill DnD integration with visual feedback
- [ ] **7.2.4.8**: Implement TagPill keyboard navigation
- [ ] **7.2.4.9**: Create TagPill Storybook stories (all variants, states, interactions)
- [ ] **Test**: TagPill renders with correct color and text
- [ ] **Test**: TagPill selection state changes correctly
- [ ] **Test**: TagPill multi-selection works with keyboard modifiers
- [ ] **Test**: TagPill context menu appears on right-click
- [ ] **Test**: TagPill DnD events fire correctly
- [ ] **Test**: TagPill accessibility (ARIA roles, keyboard navigation)

**Phase 7.2.5: Checkbox Component**
- [ ] **7.2.5.1**: Write Checkbox component tests (rendering, states, i18n, help mode)
- [ ] **7.2.5.2**: Implement Checkbox component for file selection
- [ ] **7.2.5.3**: Add Checkbox i18n support with labels
- [ ] **7.2.5.4**: Implement Checkbox help mode support
- [ ] **7.2.5.5**: Create Checkbox Storybook stories (all states, help mode)
- [ ] **Test**: Checkbox toggles state correctly
- [ ] **Test**: Checkbox shows help text in help mode
- [ ] **Test**: Checkbox keyboard navigation (Space)
- [ ] **Test**: Checkbox accessibility (ARIA checked state)

**Phase 7.2.6: Dropdown Component**
- [ ] **7.2.6.1**: Write Dropdown component tests (rendering, selection, keyboard, help mode)
- [ ] **7.2.6.2**: Implement Dropdown component for mode selection
- [ ] **7.2.6.3**: Add Dropdown keyboard navigation (Arrow keys, Enter, Escape)
- [ ] **7.2.6.4**: Implement Dropdown i18n support
- [ ] **7.2.6.5**: Add Dropdown help mode support
- [ ] **7.2.6.6**: Create Dropdown Storybook stories (all states, interactions)
- [ ] **Test**: Dropdown opens and closes correctly
- [ ] **Test**: Dropdown selection works with mouse and keyboard
- [ ] **Test**: Dropdown shows help text in help mode
- [ ] **Test**: Dropdown accessibility (ARIA expanded, options)

**Phase 7.3: Molecule Components (Test-First Development)**

**Phase 7.3.1: SearchBox Component**
- [ ] **7.3.1.1**: Write SearchBox component tests (rendering, search, clear, i18n)
- [ ] **7.3.1.2**: Implement SearchBox with search icon and clear button
- [ ] **7.3.1.3**: Add SearchBox loading states
- [ ] **7.3.1.4**: Implement SearchBox i18n support
- [ ] **7.3.1.5**: Create SearchBox Storybook stories (all states, interactions)
- [ ] **Test**: SearchBox triggers search on input
- [ ] **Test**: SearchBox clear button resets input
- [ ] **Test**: SearchBox shows loading state
- [ ] **Test**: SearchBox accessibility (search role, clear button)

**Phase 7.3.2: Modal Component**
- [ ] **7.3.2.1**: Write Modal component tests (rendering, backdrop, focus, keyboard)
- [ ] **7.3.2.2**: Implement Modal with backdrop and close handling
- [ ] **7.3.2.3**: Add Modal focus management (trap focus, restore focus)
- [ ] **7.3.2.4**: Implement Modal keyboard handling (Escape to close)
- [ ] **7.3.2.5**: Create Modal Storybook stories (all states, interactions)
- [ ] **Test**: Modal opens and closes correctly
- [ ] **Test**: Modal traps focus within content
- [ ] **Test**: Modal restores focus on close
- [ ] **Test**: Modal accessibility (ARIA modal, focus management)

**Phase 7.3.3: Tooltip Component**
- [ ] **7.3.3.1**: Write Tooltip component tests (rendering, positioning, timing)
- [ ] **7.3.3.2**: Implement Tooltip for contextual help
- [ ] **7.3.3.3**: Add Tooltip positioning (top, bottom, left, right)
- [ ] **7.3.3.4**: Implement Tooltip timing (show/hide delays)
- [ ] **7.3.3.5**: Create Tooltip Storybook stories (all positions, timing)
- [ ] **Test**: Tooltip appears on hover
- [ ] **Test**: Tooltip positions correctly
- [ ] **Test**: Tooltip accessibility (ARIA describedby)

**Phase 7.3.4: DocPopover Component**
- [ ] **7.3.4.1**: Write DocPopover component tests (rendering, positioning, help mode)
- [ ] **7.3.4.2**: Implement DocPopover for help mode documentation
- [ ] **7.3.4.3**: Add DocPopover positioning options
- [ ] **7.3.4.4**: Implement DocPopover help mode integration
- [ ] **7.3.4.5**: Create DocPopover Storybook stories (all positions, help mode)
- [ ] **Test**: DocPopover shows in help mode only
- [ ] **Test**: DocPopover positions correctly
- [ ] **Test**: DocPopover accessibility (ARIA role, content)

**Phase 7.3.5: BrowseInput Component**
- [ ] **7.3.5.1**: Write BrowseInput component tests (rendering, file picker, validation)
- [ ] **7.3.5.2**: Implement BrowseInput with Browse button
- [ ] **7.3.5.3**: Add BrowseInput system directory picker integration
- [ ] **7.3.5.4**: Implement BrowseInput path validation
- [ ] **7.3.5.5**: Create BrowseInput Storybook stories (all states, validation)
- [ ] **Test**: BrowseInput opens system picker
- [ ] **Test**: BrowseInput validates paths correctly
- [ ] **Test**: BrowseInput shows error states
- [ ] **Test**: BrowseInput accessibility (file input, button)

**Phase 7.3.6: ToggleButtonGroup Component**
- [ ] **7.3.6.1**: Write ToggleButtonGroup component tests (rendering, selection, mutual exclusion)
- [ ] **7.3.6.2**: Implement ToggleButtonGroup for sync selection
- [ ] **7.3.6.3**: Add ToggleButtonGroup mutual exclusion logic
- [ ] **7.3.6.4**: Implement ToggleButtonGroup keyboard navigation
- [ ] **7.3.6.5**: Create ToggleButtonGroup Storybook stories (all states, interactions)
- [ ] **Test**: ToggleButtonGroup enforces mutual exclusion
- [ ] **Test**: ToggleButtonGroup keyboard navigation works
- [ ] **Test**: ToggleButtonGroup accessibility (ARIA group, selected state)

**Phase 7.3.7: TabGroup Component**
- [ ] **7.3.7.1**: Write TabGroup component tests (rendering, selection, keyboard, panels)
- [ ] **7.3.7.2**: Implement TabGroup for Library and View tabs
- [ ] **7.3.7.3**: Add TabGroup keyboard navigation (Arrow keys, Home, End)
- [ ] **7.3.7.4**: Implement TabGroup panel switching
- [ ] **7.3.7.5**: Create TabGroup Storybook stories (all states, interactions)
- [ ] **Test**: TabGroup switches panels correctly
- [ ] **Test**: TabGroup keyboard navigation works
- [ ] **Test**: TabGroup accessibility (ARIA tabs, panels)

**Phase 7.3.8: ActionButtonGroup Component**
- [ ] **7.3.8.1**: Write ActionButtonGroup component tests (rendering, actions, states)
- [ ] **7.3.8.2**: Implement ActionButtonGroup for CRUD operations
- [ ] **7.3.8.3**: Add ActionButtonGroup action handling
- [ ] **7.3.8.4**: Implement ActionButtonGroup state management
- [ ] **7.3.8.5**: Create ActionButtonGroup Storybook stories (all actions, states)
- [ ] **Test**: ActionButtonGroup triggers correct actions
- [ ] **Test**: ActionButtonGroup manages states correctly
- [ ] **Test**: ActionButtonGroup accessibility (button group)

**Phase 7.3.9: SelectionControls Component**
- [ ] **7.3.9.1**: Write SelectionControls component tests (rendering, actions, filter respect)
- [ ] **7.3.9.2**: Implement SelectionControls (Select All/Clear/Invert)
- [ ] **7.3.9.3**: Add SelectionControls filter respect logic
- [ ] **7.3.9.4**: Implement SelectionControls state management
- [ ] **7.3.9.5**: Create SelectionControls Storybook stories (all actions, states)
- [ ] **Test**: SelectionControls respects current filters
- [ ] **Test**: SelectionControls inverts selection correctly
- [ ] **Test**: SelectionControls accessibility (button group)

**Phase 7.4: Complex Organism Components (Test-First Development)**

**Phase 7.4.1: FilterBuilder Component (Critical)**
- [ ] **7.4.1.1**: Write FilterBuilder component tests (rendering, nodes, connectors, DnD)
- [ ] **7.4.1.2**: Implement FilterBuilder container managing filter chain
- [ ] **7.4.1.3**: Add FilterBuilder horizontal scrolling for multiple nodes
- [ ] **7.4.1.4**: Implement FilterBuilder DnD integration for tag pills
- [ ] **7.4.1.5**: Add FilterBuilder smart album integration
- [ ] **7.4.1.6**: Implement FilterBuilder state synchronization
- [ ] **7.4.1.7**: Add FilterBuilder change detection
- [ ] **7.4.1.8**: Create FilterBuilder Storybook stories (empty, single, multi-node, DnD)
- [ ] **Test**: FilterBuilder renders nodes correctly
- [ ] **Test**: FilterBuilder handles connector changes
- [ ] **Test**: FilterBuilder DnD integration works
- [ ] **Test**: FilterBuilder state synchronization works
- [ ] **Test**: FilterBuilder accessibility (keyboard navigation, ARIA)

**Phase 7.4.2: FilterNode Component**
- [ ] **7.4.2.1**: Write FilterNode component tests (rendering, mode, tags, DnD)
- [ ] **7.4.2.2**: Implement FilterNode with tag pills and mode selector
- [ ] **7.4.2.3**: Add FilterNode mode switching (all/any)
- [ ] **7.4.2.4**: Implement FilterNode tag management
- [ ] **7.4.2.5**: Add FilterNode DnD drop target
- [ ] **7.4.2.6**: Create FilterNode Storybook stories (all modes, states)
- [ ] **Test**: FilterNode renders with correct mode
- [ ] **Test**: FilterNode mode switching works
- [ ] **Test**: FilterNode accepts dropped tags
- [ ] **Test**: FilterNode accessibility (mode selector, tag list)

**Phase 7.4.3: FilterConnector Component**
- [ ] **7.4.3.1**: Write FilterConnector component tests (rendering, selection, node creation)
- [ ] **7.4.3.2**: Implement FilterConnector dropdown (and/or/and not/none)
- [ ] **7.4.3.3**: Add FilterConnector node creation/pruning logic
- [ ] **7.4.3.4**: Implement FilterConnector state management
- [ ] **7.4.3.5**: Create FilterConnector Storybook stories (all connectors, states)
- [ ] **Test**: FilterConnector creates nodes when changed from none
- [ ] **Test**: FilterConnector prunes nodes when changed to none
- [ ] **Test**: FilterConnector accessibility (dropdown, options)

**Phase 7.4.4: DirectoryInput Component**
- [ ] **7.4.4.1**: Write DirectoryInput component tests (rendering, picker, validation, error states)
- [ ] **7.4.4.2**: Implement DirectoryInput with system directory picker
- [ ] **7.4.4.3**: Add DirectoryInput path validation (existence, accessibility, network drives)
- [ ] **7.4.4.4**: Implement DirectoryInput error states (red text field)
- [ ] **7.4.4.5**: Add DirectoryInput load content button
- [ ] **7.4.4.6**: Implement DirectoryInput progress feedback
- [ ] **7.4.4.7**: Add DirectoryInput error handling (clear sections)
- [ ] **7.4.4.8**: Create DirectoryInput Storybook stories (all states, validation)
- [ ] **Test**: DirectoryInput opens system picker
- [ ] **Test**: DirectoryInput validates paths correctly
- [ ] **Test**: DirectoryInput shows error states
- [ ] **Test**: DirectoryInput handles network drives
- [ ] **Test**: DirectoryInput accessibility (file input, validation)

**Phase 7.4.5: SmartAlbumsTree Component**
- [ ] **7.4.5.1**: Write SmartAlbumsTree component tests (rendering, tree, CRUD, selection)
- [ ] **7.4.5.2**: Implement SmartAlbumsTree hierarchical tree structure
- [ ] **7.4.5.3**: Add SmartAlbumsTree album actions (Load/Update/Add/Delete)
- [ ] **7.4.5.4**: Implement SmartAlbumsTree selection highlighting
- [ ] **7.4.5.5**: Add SmartAlbumsTree expand/collapse functionality
- [ ] **7.4.5.6**: Implement SmartAlbumsTree FilterBuilder integration
- [ ] **7.4.5.7**: Add SmartAlbumsTree update button logic
- [ ] **7.4.5.8**: Create SmartAlbumsTree Storybook stories (tree, actions, states)
- [ ] **Test**: SmartAlbumsTree renders tree correctly
- [ ] **Test**: SmartAlbumsTree CRUD operations work
- [ ] **Test**: SmartAlbumsTree selection highlighting works
- [ ] **Test**: SmartAlbumsTree FilterBuilder integration works
- [ ] **Test**: SmartAlbumsTree accessibility (tree navigation, actions)

**Phase 7.4.6: SyncPanel Component**
- [ ] **7.4.6.1**: Write SyncPanel component tests (rendering, mode, source/target, preview)
- [ ] **7.4.6.2**: Implement SyncPanel with mode selector (Add/Overwrite/Tags)
- [ ] **7.4.6.3**: Add SyncPanel source/target selector (mutually exclusive)
- [ ] **7.4.6.4**: Implement SyncPanel execute button
- [ ] **7.4.6.5**: Add SyncPanel operation preview pop-up
- [ ] **7.4.6.6**: Implement SyncPanel atomic operations
- [ ] **7.4.6.7**: Add SyncPanel validation rules
- [ ] **7.4.6.8**: Create SyncPanel Storybook stories (all modes, states)
- [ ] **Test**: SyncPanel enforces mutually exclusive toggles
- [ ] **Test**: SyncPanel shows operation preview
- [ ] **Test**: SyncPanel validates operations
- [ ] **Test**: SyncPanel accessibility (form controls, validation)

**Phase 7.4.7: OtherCommands Component**
- [ ] **7.4.7.1**: Write OtherCommands component tests (rendering, dropdown, execution)
- [ ] **7.4.7.2**: Implement OtherCommands dropdown with command list
- [ ] **7.4.7.3**: Add OtherCommands database backup functionality
- [ ] **7.4.7.4**: Implement OtherCommands command execution
- [ ] **7.4.7.5**: Add OtherCommands confirmation dialogs
- [ ] **7.4.7.6**: Create OtherCommands Storybook stories (all commands, states)
- [ ] **Test**: OtherCommands dropdown works
- [ ] **Test**: OtherCommands executes commands correctly
- [ ] **Test**: OtherCommands shows confirmations
- [ ] **Test**: OtherCommands accessibility (dropdown, actions)

**Phase 7.4.8: TagLibrary Component**
- [ ] **7.4.8.1**: Write TagLibrary component tests (rendering, tabs, DnD, multi-selection)
- [ ] **7.4.8.2**: Implement TagLibrary with tabs (Automatic/User Defined/Groups)
- [ ] **7.4.8.3**: Add TagLibrary tag list with sorting
- [ ] **7.4.8.4**: Implement TagLibrary tag selection
- [ ] **7.4.8.5**: Add TagLibrary tag actions (Add/Remove)
- [ ] **7.4.8.6**: Implement TagLibrary DnD integration
- [ ] **7.4.8.7**: Add TagLibrary multi-selection support
- [ ] **7.4.8.8**: Implement TagLibrary context menus
- [ ] **7.4.8.9**: Add TagLibrary tab management
- [ ] **7.4.8.10**: Create TagLibrary Storybook stories (all tabs, interactions)
- [ ] **Test**: TagLibrary renders tabs correctly
- [ ] **Test**: TagLibrary DnD between Library and Selection works
- [ ] **Test**: TagLibrary multi-selection works
- [ ] **Test**: TagLibrary context menus work
- [ ] **Test**: TagLibrary accessibility (tabs, lists, actions)

**Phase 7.5: View-Specific Components (Test-First Development)**

**Phase 7.5.1: StatisticsView Component**
- [ ] **7.5.1.1**: Write StatisticsView component tests (rendering, file types, selection, progress)
- [ ] **7.5.1.2**: Implement StatisticsView with file type breakdown
- [ ] **7.5.1.3**: Add StatisticsView file type checkboxes (.jpg, .png, .mpg, .mp4)
- [ ] **7.5.1.4**: Implement StatisticsView file counts and sizes
- [ ] **7.5.1.5**: Add StatisticsView selection summary
- [ ] **7.5.1.6**: Implement StatisticsView progress indicators
- [ ] **7.5.1.7**: Add StatisticsView file type selection logic
- [ ] **7.5.1.8**: Create StatisticsView Storybook stories (all states, interactions)
- [ ] **Test**: StatisticsView renders file type breakdown
- [ ] **Test**: StatisticsView file type selection works
- [ ] **Test**: StatisticsView shows progress indicators
- [ ] **Test**: StatisticsView accessibility (checkboxes, summaries)

**Phase 7.5.2: ListView Component**
- [ ] **7.5.2.1**: Write ListView component tests (rendering, table, sorting, selection, virtualization)
- [ ] **7.5.2.2**: Implement ListView with file table
- [ ] **7.5.2.3**: Add ListView sortable column headers
- [ ] **7.5.2.4**: Implement ListView column management (resizable, auto-resizable)
- [ ] **7.5.2.5**: Add ListView virtualization for large file lists
- [ ] **7.5.2.6**: Implement ListView selection behavior (click row toggles)
- [ ] **7.5.2.7**: Create ListView Storybook stories (all columns, sorting, selection)
- [ ] **Test**: ListView renders table correctly
- [ ] **Test**: ListView all columns are sortable
- [ ] **Test**: ListView column resizing works
- [ ] **Test**: ListView virtualization handles large datasets
- [ ] **Test**: ListView accessibility (table, sorting, selection)

**Phase 7.5.3: FileView Component**
- [ ] **7.5.3.1**: Write FileView component tests (rendering, navigation, metadata, fullscreen)
- [ ] **7.5.3.2**: Implement FileView with large image display
- [ ] **7.5.3.3**: Add FileView navigation arrows (previous/next)
- [ ] **7.5.3.4**: Implement FileView file metadata display
- [ ] **7.5.3.5**: Add FileView fullscreen button
- [ ] **7.5.3.6**: Implement FileView selection navigation
- [ ] **7.5.3.7**: Add FileView end-of-list handling
- [ ] **7.5.3.8**: Implement FileView keyboard navigation
- [ ] **7.5.3.9**: Create FileView Storybook stories (all states, navigation)
- [ ] **Test**: FileView displays images correctly
- [ ] **Test**: FileView navigation arrows work
- [ ] **Test**: FileView shows metadata correctly
- [ ] **Test**: FileView fullscreen works
- [ ] **Test**: FileView accessibility (navigation, image description)

**Phase 7.5.4: LocationView Component**
- [ ] **7.5.4.1**: Write LocationView component tests (rendering, map, markers, clustering)
- [ ] **7.5.4.2**: Implement LocationView with OpenStreetMap integration
- [ ] **7.5.4.3**: Add LocationView location markers with counts
- [ ] **7.5.4.4**: Implement LocationView location clustering
- [ ] **7.5.4.5**: Add LocationView map controls (zoom, pan)
- [ ] **7.5.4.6**: Implement LocationView selection integration
- [ ] **7.5.4.7**: Add LocationView fullscreen button
- [ ] **7.5.4.8**: Create LocationView Storybook stories (all states, interactions)
- [ ] **Test**: LocationView displays map correctly
- [ ] **Test**: LocationView shows markers with counts
- [ ] **Test**: LocationView clustering works
- [ ] **Test**: LocationView map controls work
- [ ] **Test**: LocationView accessibility (map, markers)

**Phase 7.5.5: ViewControls Component**
- [ ] **7.5.5.1**: Write ViewControls component tests (rendering, tabs, selection, fullscreen)
- [ ] **7.5.5.2**: Implement ViewControls with view mode tabs
- [ ] **7.5.5.3**: Add ViewControls fullscreen button (File and Location views only)
- [ ] **7.5.5.4**: Implement ViewControls selection controls
- [ ] **7.5.5.5**: Add ViewControls filter respect logic
- [ ] **7.5.5.6**: Implement ViewControls selection toggle
- [ ] **7.5.5.7**: Create ViewControls Storybook stories (all modes, states)
- [ ] **Test**: ViewControls switches view modes correctly
- [ ] **Test**: ViewControls fullscreen button works for File/Location
- [ ] **Test**: ViewControls selection controls work
- [ ] **Test**: ViewControls respects filters
- [ ] **Test**: ViewControls accessibility (tabs, buttons)

**Phase 7.6: Layout Management (Test-First Development)**

**Phase 7.6.1: AppLayout Component**
- [ ] **7.6.1.1**: Write AppLayout component tests (rendering, 2-row structure, responsive)
- [ ] **7.6.1.2**: Implement AppLayout with main 2-row layout container
- [ ] **7.6.1.3**: Add AppLayout responsive design for different screen sizes
- [ ] **7.6.1.4**: Create AppLayout Storybook stories (all layouts, responsive)
- [ ] **Test**: AppLayout renders 2-row structure correctly
- [ ] **Test**: AppLayout adapts to different screen sizes
- [ ] **Test**: AppLayout accessibility (layout landmarks)

**Phase 7.6.2: TopRowLayout Component**
- [ ] **7.6.2.1**: Write TopRowLayout component tests (rendering, panels, resizing)
- [ ] **7.6.2.2**: Implement TopRowLayout (Filter + Smart Albums + Sync panels)
- [ ] **7.6.2.3**: Add TopRowLayout panel resizing
- [ ] **7.6.2.4**: Implement TopRowLayout panel collapsing
- [ ] **7.6.2.5**: Create TopRowLayout Storybook stories (all states, resizing)
- [ ] **Test**: TopRowLayout renders panels correctly
- [ ] **Test**: TopRowLayout panel resizing works
- [ ] **Test**: TopRowLayout panel collapsing works
- [ ] **Test**: TopRowLayout accessibility (panel landmarks)

**Phase 7.6.3: BottomRowLayout Component**
- [ ] **7.6.3.1**: Write BottomRowLayout component tests (rendering, panels, resizing)
- [ ] **7.6.3.2**: Implement BottomRowLayout (Tags + Main View panels)
- [ ] **7.6.3.3**: Add BottomRowLayout panel resizing
- [ ] **7.6.3.4**: Implement BottomRowLayout panel collapsing
- [ ] **7.6.3.5**: Create BottomRowLayout Storybook stories (all states, resizing)
- [ ] **Test**: BottomRowLayout renders panels correctly
- [ ] **Test**: BottomRowLayout panel resizing works
- [ ] **Test**: BottomRowLayout panel collapsing works
- [ ] **Test**: BottomRowLayout accessibility (panel landmarks)

**Phase 7.6.4: PanelResizing Component**
- [ ] **7.6.4.1**: Write PanelResizing component tests (rendering, handles, resize logic)
- [ ] **7.6.4.2**: Implement PanelResizing with two resize handles only
- [ ] **7.6.4.3**: Add PanelResizing vertical handle (between Tags/View)
- [ ] **7.6.4.4**: Implement PanelResizing horizontal handle (between top/bottom rows)
- [ ] **7.6.4.5**: Create PanelResizing Storybook stories (all handles, interactions)
- [ ] **Test**: PanelResizing has only two handles
- [ ] **Test**: PanelResizing vertical handle works
- [ ] **Test**: PanelResizing horizontal handle works
- [ ] **Test**: PanelResizing accessibility (resize handles)

**Phase 7.6.5: PanelCollapsing Component**
- [ ] **7.6.5.1**: Write PanelCollapsing component tests (rendering, collapse, expand)
- [ ] **7.6.5.2**: Implement PanelCollapsing functionality
- [ ] **7.6.5.3**: Add PanelCollapsing keyboard shortcuts
- [ ] **7.6.5.4**: Create PanelCollapsing Storybook stories (all states, interactions)
- [ ] **Test**: PanelCollapsing collapses panels correctly
- [ ] **Test**: PanelCollapsing expands panels correctly
- [ ] **Test**: PanelCollapsing keyboard shortcuts work
- [ ] **Test**: PanelCollapsing accessibility (collapse/expand)

**Phase 7.7: DnD Infrastructure (Test-First Development)**

**Phase 7.7.1: TagDnD System**
- [ ] **7.7.1.1**: Write TagDnD system tests (drag, drop, visual feedback, multi-item)
- [ ] **7.7.1.2**: Implement TagDnD from Library to Selection
- [ ] **7.7.1.3**: Add TagDnD visual feedback during drag operations
- [ ] **7.7.1.4**: Implement TagDnD drop zones with clear indicators
- [ ] **7.7.1.5**: Add TagDnD multi-item DnD support
- [ ] **7.7.1.6**: Create TagDnD Storybook stories (all interactions, feedback)
- [ ] **Test**: TagDnD drag from Library works
- [ ] **Test**: TagDnD drop to Selection works
- [ ] **Test**: TagDnD visual feedback is clear
- [ ] **Test**: TagDnD multi-item DnD works
- [ ] **Test**: TagDnD accessibility (drag/drop announcements)

**Phase 7.7.2: FilterDnD System**
- [ ] **7.7.2.1**: Write FilterDnD system tests (drag, drop, node creation, visual feedback)
- [ ] **7.7.2.2**: Implement FilterDnD to FilterBuilder nodes
- [ ] **7.7.2.3**: Add FilterDnD node creation on drop
- [ ] **7.7.2.4**: Implement FilterDnD visual feedback
- [ ] **7.7.2.5**: Create FilterDnD Storybook stories (all interactions, node creation)
- [ ] **Test**: FilterDnD drag to FilterBuilder works
- [ ] **Test**: FilterDnD creates nodes on drop
- [ ] **Test**: FilterDnD visual feedback is clear
- [ ] **Test**: FilterDnD accessibility (drag/drop announcements)

**Phase 7.8: Help System (Test-First Development)**

**Phase 7.8.1: HelpModeToggle Component**
- [ ] **7.8.1.1**: Write HelpModeToggle component tests (rendering, toggle, keyboard)
- [ ] **7.8.1.2**: Implement HelpModeToggle button
- [ ] **7.8.1.3**: Add HelpModeToggle keyboard shortcuts (ESC, ?)
- [ ] **7.8.1.4**: Implement HelpModeToggle visual state indication
- [ ] **7.8.1.5**: Create HelpModeToggle Storybook stories (all states, interactions)
- [ ] **Test**: HelpModeToggle toggles help mode correctly
- [ ] **Test**: HelpModeToggle keyboard shortcuts work
- [ ] **Test**: HelpModeToggle shows visual state
- [ ] **Test**: HelpModeToggle accessibility (button, state)

**Phase 7.8.2: HelpModeProvider Context**
- [ ] **7.8.2.1**: Write HelpModeProvider context tests (state, toggle, exit)
- [ ] **7.8.2.2**: Implement HelpModeProvider context
- [ ] **7.8.2.3**: Add HelpModeProvider state management
- [ ] **7.8.2.4**: Implement HelpModeProvider keyboard handling
- [ ] **7.8.2.5**: Create HelpModeProvider Storybook stories (all states, interactions)
- [ ] **Test**: HelpModeProvider manages state correctly
- [ ] **Test**: HelpModeProvider toggles help mode
- [ ] **Test**: HelpModeProvider exits help mode
- [ ] **Test**: HelpModeProvider keyboard handling works

**Phase 7.8.3: CursorChange System**
- [ ] **7.8.3.1**: Write CursorChange system tests (cursor change, help mode)
- [ ] **7.8.3.2**: Implement CursorChange to "?" in help mode
- [ ] **7.8.3.3**: Add CursorChange CSS cursor property
- [ ] **7.8.3.4**: Create CursorChange Storybook stories (help mode, cursor)
- [ ] **Test**: CursorChange changes cursor in help mode
- [ ] **Test**: CursorChange restores cursor when exiting help mode
- [ ] **Test**: CursorChange accessibility (cursor change)

**Phase 7.8.4: ContextualHelp System**
- [ ] **7.8.4.1**: Write ContextualHelp system tests (hover, doc text, help mode)
- [ ] **7.8.4.2**: Implement ContextualHelp with doc text
- [ ] **7.8.4.3**: Add ContextualHelp hover behavior
- [ ] **7.8.4.4**: Implement ContextualHelp help mode integration
- [ ] **7.8.4.5**: Create ContextualHelp Storybook stories (all states, interactions)
- [ ] **Test**: ContextualHelp shows doc text in help mode
- [ ] **Test**: ContextualHelp shows hint text in normal mode
- [ ] **Test**: ContextualHelp hover behavior works
- [ ] **Test**: ContextualHelp accessibility (help text)

**Phase 7.8.5: HelpModeIndicator Component**
- [ ] **7.8.5.1**: Write HelpModeIndicator component tests (rendering, visibility, styling)
- [ ] **7.8.5.2**: Implement HelpModeIndicator visual indicator
- [ ] **7.8.5.3**: Add HelpModeIndicator styling (border, background)
- [ ] **7.8.5.4**: Create HelpModeIndicator Storybook stories (all states, styling)
- [ ] **Test**: HelpModeIndicator shows when help mode is active
- [ ] **Test**: HelpModeIndicator hides when help mode is inactive
- [ ] **Test**: HelpModeIndicator accessibility (indicator)

**Phase 7.8.6: HelpModeStyles System**
- [ ] **7.8.6.1**: Write HelpModeStyles system tests (CSS, cursor, indicators)
- [ ] **7.8.6.2**: Implement HelpModeStyles CSS styles
- [ ] **7.8.6.3**: Add HelpModeStyles cursor styles
- [ ] **7.8.6.4**: Implement HelpModeStyles visual indicators
- [ ] **7.8.6.5**: Create HelpModeStyles Storybook stories (all styles, states)
- [ ] **Test**: HelpModeStyles applies cursor styles correctly
- [ ] **Test**: HelpModeStyles applies visual indicators correctly
- [ ] **Test**: HelpModeStyles accessibility (style changes)

**Phase 7.9: Storybook Configuration (Test-First Development)**

**Phase 7.9.1: Storybook Setup**
- [ ] **7.9.1.1**: Write Storybook configuration tests (build, run, MSW integration)
- [ ] **7.9.1.2**: Configure Storybook with MSW for API mocking
- [ ] **7.9.1.3**: Add Storybook visual regression testing
- [ ] **7.9.1.4**: Implement Storybook accessibility testing
- [ ] **7.9.1.5**: Create Storybook test suite (all components, interactions)
- [ ] **Test**: Storybook builds and runs correctly
- [ ] **Test**: Storybook MSW integration works
- [ ] **Test**: Storybook visual regression tests pass
- [ ] **Test**: Storybook accessibility tests pass

**Phase 7.9.2: Component Stories**
- [ ] **7.9.2.1**: Write component story tests (rendering, interactions, states)
- [ ] **7.9.2.2**: Create FilterBuilder stories (empty, single, multi-node, pruning)
- [ ] **7.9.2.3**: Create View mode stories with sample data
- [ ] **7.9.2.4**: Create Layout stories for resizing/collapsing
- [ ] **7.9.2.5**: Create DnD stories for interactions
- [ ] **7.9.2.6**: Create Help mode stories
- [ ] **7.9.2.7**: Create TagPill stories with all variants
- [ ] **7.9.2.8**: Create Integration stories for workflows
- [ ] **Test**: All component stories render correctly
- [ ] **Test**: All component stories show interactions
- [ ] **Test**: All component stories show states
- [ ] **Test**: All component stories accessibility compliance

**Phase 7.10: In-App Component Zoo (Test-First Development)**

**Phase 7.10.1: Component Zoo Setup**
- [ ] **7.10.1.1**: Write Component Zoo tests (route, rendering, navigation)
- [ ] **7.10.1.2**: Implement `/zoo` route in web app
- [ ] **7.10.1.3**: Add Component Zoo navigation
- [ ] **7.10.1.4**: Create Component Zoo test suite
- [ ] **Test**: Component Zoo route works
- [ ] **Test**: Component Zoo navigation works
- [ ] **Test**: Component Zoo accessibility

**Phase 7.10.2: Component Showcase**
- [ ] **7.10.2.1**: Write Component Showcase tests (rendering, interactions, examples)
- [ ] **7.10.2.2**: Create Component showcase pages
- [ ] **7.10.2.3**: Add Interactive examples and playgrounds
- [ ] **7.10.2.4**: Create View mode demonstrations
- [ ] **7.10.2.5**: Add DnD playground
- [ ] **7.10.2.6**: Create Help mode demonstration
- [ ] **7.10.2.7**: Add Component testing utilities
- [ ] **7.10.2.8**: Create Performance monitoring
- [ ] **Test**: Component showcase pages work
- [ ] **Test**: Interactive examples work
- [ ] **Test**: DnD playground works
- [ ] **Test**: Help mode demonstration works
- [ ] **Test**: Performance monitoring works

**Phase 7.10.3: Tutorials System (Test-First Development)**

**Phase 7.10.3.1: TutorialsButton Component**
- [ ] **7.10.3.1.1**: Write TutorialsButton component tests (rendering, click, new tab)
- [ ] **7.10.3.1.2**: Implement TutorialsButton in top-left frame
- [ ] **7.10.3.1.3**: Add TutorialsButton new tab functionality
- [ ] **7.10.3.1.4**: Create TutorialsButton Storybook stories
- [ ] **Test**: TutorialsButton renders correctly
- [ ] **Test**: TutorialsButton opens new tab
- [ ] **Test**: TutorialsButton accessibility

**Phase 7.10.3.2: TutorialsPage Component**
- [ ] **7.10.3.2.1**: Write TutorialsPage component tests (rendering, layout, responsive)
- [ ] **7.10.3.2.2**: Implement TutorialsPage with two-column layout
- [ ] **7.10.3.2.3**: Add TutorialsPage responsive design
- [ ] **7.10.3.2.4**: Create TutorialsPage Storybook stories
- [ ] **Test**: TutorialsPage renders two-column layout
- [ ] **Test**: TutorialsPage responsive design works
- [ ] **Test**: TutorialsPage accessibility

**Phase 7.10.3.3: TutorialList Component**
- [ ] **7.10.3.3.1**: Write TutorialList component tests (rendering, selection, search)
- [ ] **7.10.3.3.2**: Implement TutorialList in left column
- [ ] **7.10.3.3.3**: Add TutorialList search/filter functionality
- [ ] **7.10.3.3.4**: Implement TutorialList completion status
- [ ] **7.10.3.3.5**: Create TutorialList Storybook stories
- [ ] **Test**: TutorialList renders tutorials correctly
- [ ] **Test**: TutorialList search/filter works
- [ ] **Test**: TutorialList completion status works
- [ ] **Test**: TutorialList accessibility

**Phase 7.10.3.4: TutorialRunner Component**
- [ ] **7.10.3.4.1**: Write TutorialRunner component tests (rendering, steps, navigation)
- [ ] **7.10.3.4.2**: Implement TutorialRunner in right column
- [ ] **7.10.3.4.3**: Add TutorialRunner step-by-step guidance
- [ ] **7.10.3.4.4**: Implement TutorialRunner Playwright integration
- [ ] **7.10.3.4.5**: Add TutorialRunner tutorial i18n matrix
- [ ] **7.10.3.4.6**: Implement TutorialRunner tutorial navigation
- [ ] **7.10.3.4.7**: Add TutorialRunner tutorial progress tracking
- [ ] **7.10.3.4.8**: Implement TutorialRunner tutorial state management
- [ ] **7.10.3.4.9**: Add TutorialRunner tutorial scripts
- [ ] **7.10.3.4.10**: Implement TutorialRunner tutorial overlay
- [ ] **7.10.3.4.11**: Add TutorialRunner tutorial controls
- [ ] **7.10.3.4.12**: Implement TutorialRunner tutorial completion feedback
- [ ] **7.10.3.4.13**: Create TutorialRunner Storybook stories
- [ ] **Test**: TutorialRunner renders full GUI
- [ ] **Test**: TutorialRunner step-by-step guidance works
- [ ] **Test**: TutorialRunner Playwright integration works
- [ ] **Test**: TutorialRunner tutorial i18n system works
- [ ] **Test**: TutorialRunner tutorial navigation works
- [ ] **Test**: TutorialRunner tutorial progress tracking works
- [ ] **Test**: TutorialRunner tutorial state management works
- [ ] **Test**: TutorialRunner tutorial scripts execute correctly
- [ ] **Test**: TutorialRunner tutorial overlay works
- [ ] **Test**: TutorialRunner tutorial controls work
- [ ] **Test**: TutorialRunner tutorial completion feedback works
- [ ] **Test**: TutorialRunner accessibility

**Phase 7.11: TagPill Advanced Features (Test-First Development)**

**Phase 7.11.1: Color Management System**
- [ ] **7.11.1.1**: Write Color Management system tests (unique assignment, palette, persistence)
- [ ] **7.11.1.2**: Implement Color Management with unique assignment
- [ ] **7.11.1.3**: Add Color Management predefined color palette
- [ ] **7.11.1.4**: Implement Color Management persistence
- [ ] **7.11.1.5**: Create Color Management Storybook stories
- [ ] **Test**: Color Management assigns unique colors
- [ ] **Test**: Color Management uses predefined palette
- [ ] **Test**: Color Management persists colors
- [ ] **Test**: Color Management accessibility

**Phase 7.11.2: Color Picker Component**
- [ ] **7.11.2.1**: Write Color Picker component tests (rendering, selection, context menu)
- [ ] **7.11.2.2**: Implement Color Picker in context menu
- [ ] **7.11.2.3**: Add Color Picker color selection
- [ ] **7.11.2.4**: Implement Color Picker color application
- [ ] **7.11.2.5**: Create Color Picker Storybook stories
- [ ] **Test**: Color Picker appears in context menu
- [ ] **Test**: Color Picker color selection works
- [ ] **Test**: Color Picker color application works
- [ ] **Test**: Color Picker accessibility

**Phase 7.11.3: Multi-Selection System**
- [ ] **7.11.3.1**: Write Multi-Selection system tests (Shift+Click, Ctrl+Click, visual feedback)
- [ ] **7.11.3.2**: Implement Multi-Selection (Shift+Click, Ctrl+Click)
- [ ] **7.11.3.3**: Add Multi-Selection visual selection indicators
- [ ] **7.11.3.4**: Implement Multi-Selection state management
- [ ] **7.11.3.5**: Create Multi-Selection Storybook stories
- [ ] **Test**: Multi-Selection Shift+Click works
- [ ] **Test**: Multi-Selection Ctrl+Click works
- [ ] **Test**: Multi-Selection visual indicators work
- [ ] **Test**: Multi-Selection accessibility

**Phase 7.11.4: Sorting System**
- [ ] **7.11.4.1**: Write Sorting system tests (alphabetical, usage, order)
- [ ] **7.11.4.2**: Implement Sorting System (alphabetical, usage)
- [ ] **7.11.4.3**: Add Sorting System order (ascending, descending)
- [ ] **7.11.4.4**: Implement Sorting System persistence
- [ ] **7.11.4.5**: Create Sorting System Storybook stories
- [ ] **Test**: Sorting System alphabetical sorting works
- [ ] **Test**: Sorting System usage sorting works
- [ ] **Test**: Sorting System order switching works
- [ ] **Test**: Sorting System accessibility

**Phase 7.11.5: Context Menus System**
- [ ] **7.11.5.1**: Write Context Menus system tests (right-click, options, actions)
- [ ] **7.11.5.2**: Implement Context Menus (Delete/Remove/Change Color)
- [ ] **7.11.5.3**: Add Context Menus right-click behavior
- [ ] **7.11.5.4**: Implement Context Menus action handling
- [ ] **7.11.5.5**: Create Context Menus Storybook stories
- [ ] **Test**: Context Menus appear on right-click
- [ ] **Test**: Context Menus options work correctly
- [ ] **Test**: Context Menus actions execute correctly
- [ ] **Test**: Context Menus accessibility

**Phase 7.11.6: DnD Integration System**
- [ ] **7.11.6.1**: Write DnD Integration system tests (drag, drop, visual feedback, multi-item)
- [ ] **7.11.6.2**: Implement DnD Integration with visual feedback
- [ ] **7.11.6.3**: Add DnD Integration multi-item support
- [ ] **7.11.6.4**: Implement DnD Integration state management
- [ ] **7.11.6.5**: Create DnD Integration Storybook stories
- [ ] **Test**: DnD Integration visual feedback works
- [ ] **Test**: DnD Integration multi-item support works
- [ ] **Test**: DnD Integration state management works
- [ ] **Test**: DnD Integration accessibility

**Phase 7.11.7: Selection State System**
- [ ] **7.11.7.1**: Write Selection State system tests (visual indication, state management)
- [ ] **7.11.7.2**: Implement Selection State with visual indication
- [ ] **7.11.7.3**: Add Selection State different styling
- [ ] **7.11.7.4**: Implement Selection State persistence
- [ ] **7.11.7.5**: Create Selection State Storybook stories
- [ ] **Test**: Selection State visual indication works
- [ ] **Test**: Selection State different styling works
- [ ] **Test**: Selection State persistence works
- [ ] **Test**: Selection State accessibility

**Phase 7.11.8: Keyboard Navigation System**
- [ ] **7.11.8.1**: Write Keyboard Navigation system tests (arrow keys, enter, space, delete)
- [ ] **7.11.8.2**: Implement Keyboard Navigation (Arrow keys, Enter, Space, Delete)
- [ ] **7.11.8.3**: Add Keyboard Navigation focus management
- [ ] **7.11.8.4**: Implement Keyboard Navigation action handling
- [ ] **7.11.8.5**: Create Keyboard Navigation Storybook stories
- [ ] **Test**: Keyboard Navigation arrow keys work
- [ ] **Test**: Keyboard Navigation enter/space work
- [ ] **Test**: Keyboard Navigation delete works
- [ ] **Test**: Keyboard Navigation accessibility

**Phase 7.12: FilterBuilder-SmartAlbums Integration (Test-First Development)**

**Phase 7.12.1: State Synchronization System**
- [ ] **7.12.1.1**: Write State Synchronization system tests (sync, consistency, updates)
- [ ] **7.12.1.2**: Implement State Synchronization System
- [ ] **7.12.1.3**: Add State Synchronization consistency checks
- [ ] **7.12.1.4**: Implement State Synchronization update handling
- [ ] **7.12.1.5**: Create State Synchronization Storybook stories
- [ ] **Test**: State Synchronization maintains consistency
- [ ] **Test**: State Synchronization updates correctly
- [ ] **Test**: State Synchronization error handling works

**Phase 7.12.2: Load Album Workflow**
- [ ] **7.12.2.1**: Write Load Album Workflow tests (load, clear, reconstruct, scan, switch)
- [ ] **7.12.2.2**: Implement Load Album Workflow
- [ ] **7.12.2.3**: Add Load Album Workflow clear current state
- [ ] **7.12.2.4**: Implement Load Album Workflow reconstruct FilterBuilder
- [ ] **7.12.2.5**: Add Load Album Workflow update source directories
- [ ] **7.12.2.6**: Implement Load Album Workflow trigger file scan
- [ ] **7.12.2.7**: Add Load Album Workflow switch to Statistics view
- [ ] **7.12.2.8**: Create Load Album Workflow Storybook stories
- [ ] **Test**: Load Album Workflow clears current state
- [ ] **Test**: Load Album Workflow reconstructs FilterBuilder
- [ ] **Test**: Load Album Workflow updates source directories
- [ ] **Test**: Load Album Workflow triggers file scan
- [ ] **Test**: Load Album Workflow switches to Statistics view

**Phase 7.12.3: Update Album Workflow**
- [ ] **7.12.3.1**: Write Update Album Workflow tests (capture, save, update, feedback)
- [ ] **7.12.3.2**: Implement Update Album Workflow
- [ ] **7.12.3.3**: Add Update Album Workflow capture current state
- [ ] **7.12.3.4**: Implement Update Album Workflow save to album JSON
- [ ] **7.12.3.5**: Add Update Album Workflow update album state indicators
- [ ] **7.12.3.6**: Implement Update Album Workflow success feedback
- [ ] **7.12.3.7**: Create Update Album Workflow Storybook stories
- [ ] **Test**: Update Album Workflow captures current state
- [ ] **Test**: Update Album Workflow saves to album JSON
- [ ] **Test**: Update Album Workflow updates album state indicators
- [ ] **Test**: Update Album Workflow shows success feedback

**Phase 7.12.4: Change Detection System**
- [ ] **7.12.4.1**: Write Change Detection system tests (detect, track, compare)
- [ ] **7.12.4.2**: Implement Change Detection System
- [ ] **7.12.4.3**: Add Change Detection System track differences
- [ ] **7.12.4.4**: Implement Change Detection System compare states
- [ ] **7.12.4.5**: Create Change Detection System Storybook stories
- [ ] **Test**: Change Detection System detects changes
- [ ] **Test**: Change Detection System tracks differences
- [ ] **Test**: Change Detection System compares states correctly

**Phase 7.12.5: Update Button State Management**
- [ ] **7.12.5.1**: Write Update Button State Management tests (enable, disable, state)
- [ ] **7.12.5.2**: Implement Update Button State Management
- [ ] **7.12.5.3**: Add Update Button State Management enable/disable logic
- [ ] **7.12.5.4**: Implement Update Button State Management state updates
- [ ] **7.12.5.5**: Create Update Button State Management Storybook stories
- [ ] **Test**: Update Button State Management enables/disables correctly
- [ ] **Test**: Update Button State Management updates state correctly

**Phase 7.12.6: Load Confirmation Dialog**
- [ ] **7.12.6.1**: Write Load Confirmation Dialog tests (render, warn, confirm, cancel)
- [ ] **7.12.6.2**: Implement Load Confirmation Dialog
- [ ] **7.12.6.3**: Add Load Confirmation Dialog warn user
- [ ] **7.12.6.4**: Implement Load Confirmation Dialog confirm/cancel
- [ ] **7.12.6.5**: Create Load Confirmation Dialog Storybook stories
- [ ] **Test**: Load Confirmation Dialog warns user
- [ ] **Test**: Load Confirmation Dialog confirm/cancel works
- [ ] **Test**: Load Confirmation Dialog accessibility

**Phase 7.12.7: Source Directory Validation**
- [ ] **7.12.7.1**: Write Source Directory Validation tests (validate, existence, accessibility, network)
- [ ] **7.12.7.2**: Implement Source Directory Validation
- [ ] **7.12.7.3**: Add Source Directory Validation existence check
- [ ] **7.12.7.4**: Implement Source Directory Validation accessibility check
- [ ] **7.12.7.5**: Add Source Directory Validation network drives support
- [ ] **7.12.7.6**: Create Source Directory Validation Storybook stories
- [ ] **Test**: Source Directory Validation checks existence
- [ ] **Test**: Source Directory Validation checks accessibility
- [ ] **Test**: Source Directory Validation supports network drives

**Phase 7.12.8: Album State Indicators**
- [ ] **7.12.8.1**: Write Album State Indicators tests (render, modified, unsaved, visual)
- [ ] **7.12.8.2**: Implement Album State Indicators
- [ ] **7.12.8.3**: Add Album State Indicators visual feedback
- [ ] **7.12.8.4**: Implement Album State Indicators modified/unsaved status
- [ ] **7.12.8.5**: Create Album State Indicators Storybook stories
- [ ] **Test**: Album State Indicators show visual feedback
- [ ] **Test**: Album State Indicators show modified/unsaved status
- [ ] **Test**: Album State Indicators accessibility

**Phase 7.12.9: Error Handling System**
- [ ] **7.12.9.1**: Write Error Handling system tests (handle, recover, graceful, feedback)
- [ ] **7.12.9.2**: Implement Error Handling System
- [ ] **7.12.9.3**: Add Error Handling System graceful handling
- [ ] **7.12.9.4**: Implement Error Handling System error recovery
- [ ] **7.12.9.5**: Add Error Handling System user feedback
- [ ] **7.12.9.6**: Create Error Handling System Storybook stories
- [ ] **Test**: Error Handling System handles errors gracefully
- [ ] **Test**: Error Handling System recovers from errors
- [ ] **Test**: Error Handling System provides user feedback

**Phase 7.13: Status Bar and Progress Indicators (Test-First Development)**

**Phase 7.13.1: StatusBar Component**
- [ ] **7.13.1.1**: Write StatusBar component tests (rendering, position, messages, styling)
- [ ] **7.13.1.2**: Implement StatusBar at bottom of application
- [ ] **7.13.1.3**: Add StatusBar status messages display
- [ ] **7.13.1.4**: Implement StatusBar error status with styling
- [ ] **7.13.1.5**: Add StatusBar operation feedback
- [ ] **7.13.1.6**: Create StatusBar Storybook stories
- [ ] **Test**: StatusBar displays at bottom
- [ ] **Test**: StatusBar shows status messages
- [ ] **Test**: StatusBar shows error status with styling
- [ ] **Test**: StatusBar shows operation feedback
- [ ] **Test**: StatusBar accessibility

**Phase 7.13.2: Progress Indicators System**
- [ ] **7.13.2.1**: Write Progress Indicators system tests (progress, long operations, completion)
- [ ] **7.13.2.2**: Implement Progress Indicators for long operations
- [ ] **7.13.2.3**: Add Progress Indicators scanning progress
- [ ] **7.13.2.4**: Implement Progress Indicators sync progress
- [ ] **7.13.2.5**: Add Progress Indicators file operations progress
- [ ] **7.13.2.6**: Create Progress Indicators Storybook stories
- [ ] **Test**: Progress Indicators show progress for long operations
- [ ] **Test**: Progress Indicators show scanning progress
- [ ] **Test**: Progress Indicators show sync progress
- [ ] **Test**: Progress Indicators show file operations progress
- [ ] **Test**: Progress Indicators accessibility

**Phase 7.14: File Operations and Database Sync (Test-First Development)**

**Phase 7.14.1: Copy/Move Operations System**
- [ ] **7.14.1.1**: Write Copy/Move Operations system tests (copy, move, sidecar, database)
- [ ] **7.14.1.2**: Implement Copy/Move Operations with sidecar handling
- [ ] **7.14.1.3**: Add Copy/Move Operations database sync
- [ ] **7.14.1.4**: Implement Copy/Move Operations confirmation dialogs
- [ ] **7.14.1.5**: Add Copy/Move Operations progress indicators
- [ ] **7.14.1.6**: Implement Copy/Move Operations error handling
- [ ] **7.14.1.7**: Add Copy/Move Operations sidecar management
- [ ] **7.14.1.8**: Create Copy/Move Operations Storybook stories
- [ ] **Test**: Copy/Move Operations work with sidecar handling
- [ ] **Test**: Copy/Move Operations sync database
- [ ] **Test**: Copy/Move Operations show confirmation dialogs
- [ ] **Test**: Copy/Move Operations show progress indicators
- [ ] **Test**: Copy/Move Operations handle errors gracefully
- [ ] **Test**: Copy/Move Operations manage sidecar files
- [ ] **Test**: Copy/Move Operations accessibility

**Phase 7.15: Confirmation Dialogs and Error Handling (Test-First Development)**

**Phase 7.15.1: ConfirmationDialog Component**
- [ ] **7.15.1.1**: Write ConfirmationDialog component tests (rendering, confirm, cancel, destructive)
- [ ] **7.15.1.2**: Implement ConfirmationDialog component
- [ ] **7.15.1.3**: Add ConfirmationDialog confirm/cancel handling
- [ ] **7.15.1.4**: Implement ConfirmationDialog destructive action warnings
- [ ] **7.15.1.5**: Add ConfirmationDialog checkbox options ("Don't show again")
- [ ] **7.15.1.6**: Create ConfirmationDialog Storybook stories
- [ ] **Test**: ConfirmationDialog renders correctly
- [ ] **Test**: ConfirmationDialog confirm/cancel works
- [ ] **Test**: ConfirmationDialog shows destructive warnings
- [ ] **Test**: ConfirmationDialog checkbox options work
- [ ] **Test**: ConfirmationDialog accessibility

**Phase 7.15.2: ErrorDialog Component**
- [ ] **7.15.2.1**: Write ErrorDialog component tests (rendering, error, retry, recovery)
- [ ] **7.15.2.2**: Implement ErrorDialog with retry options
- [ ] **7.15.2.3**: Add ErrorDialog error display
- [ ] **7.15.2.4**: Implement ErrorDialog retry mechanisms
- [ ] **7.15.2.5**: Add ErrorDialog error recovery
- [ ] **7.15.2.6**: Create ErrorDialog Storybook stories
- [ ] **Test**: ErrorDialog renders correctly
- [ ] **Test**: ErrorDialog shows error messages
- [ ] **Test**: ErrorDialog retry mechanisms work
- [ ] **Test**: ErrorDialog error recovery works
- [ ] **Test**: ErrorDialog accessibility

**Phase 7.15.3: Operation Previews System**
- [ ] **7.15.3.1**: Write Operation Previews system tests (preview, summary, actions, warnings)
- [ ] **7.15.3.2**: Implement Operation Previews
- [ ] **7.15.3.3**: Add Operation Previews summary of operations
- [ ] **7.15.3.4**: Implement Operation Previews action previews
- [ ] **7.15.3.5**: Add Operation Previews warnings
- [ ] **7.15.3.6**: Create Operation Previews Storybook stories
- [ ] **Test**: Operation Previews show summary of operations
- [ ] **Test**: Operation Previews show action previews
- [ ] **Test**: Operation Previews show warnings
- [ ] **Test**: Operation Previews accessibility

**Phase 7.16: Integration and Testing (Test-First Development)**

**Phase 7.16.1: Component Integration Testing**
- [ ] **7.16.1.1**: Write Component Integration tests (components, state, interactions)
- [ ] **7.16.1.2**: Implement Component Integration testing
- [ ] **7.16.1.3**: Add Component Integration state flow testing
- [ ] **7.16.1.4**: Implement Component Integration interaction testing
- [ ] **7.16.1.5**: Create Component Integration test suite
- [ ] **Test**: All components integrate correctly
- [ ] **Test**: Component state flow works
- [ ] **Test**: Component interactions work

**Phase 7.16.2: State Management Testing**
- [ ] **7.16.2.1**: Write State Management tests (state, persistence, synchronization)
- [ ] **7.16.2.2**: Implement State Management testing
- [ ] **7.16.2.3**: Add State Management persistence testing
- [ ] **7.16.2.4**: Implement State Management synchronization testing
- [ ] **7.16.2.5**: Create State Management test suite
- [ ] **Test**: State Management works correctly
- [ ] **Test**: State Management persistence works
- [ ] **Test**: State Management synchronization works

**Phase 7.16.3: Performance Testing**
- [ ] **7.16.3.1**: Write Performance tests (large datasets, virtualization, budgets)
- [ ] **7.16.3.2**: Implement Performance Testing with large datasets
- [ ] **7.16.3.3**: Add Performance Testing virtualization
- [ ] **7.16.3.4**: Implement Performance Testing budgets
- [ ] **7.16.3.5**: Create Performance Testing test suite
- [ ] **Test**: Performance meets requirements with large datasets
- [ ] **Test**: Performance virtualization works
- [ ] **Test**: Performance budgets are met

**Phase 7.16.4: Accessibility Testing**
- [ ] **7.16.4.1**: Write Accessibility tests (ARIA, keyboard, screen reader)
- [ ] **7.16.4.2**: Implement Accessibility Testing
- [ ] **7.16.4.3**: Add Accessibility Testing ARIA compliance
- [ ] **7.16.4.4**: Implement Accessibility Testing keyboard navigation
- [ ] **7.16.4.5**: Add Accessibility Testing screen reader support
- [ ] **7.16.4.6**: Create Accessibility Testing test suite
- [ ] **Test**: Accessibility standards are met
- [ ] **Test**: ARIA compliance works
- [ ] **Test**: Keyboard navigation works
- [ ] **Test**: Screen reader support works

**Phase 7.16.5: Cross-browser Testing**
- [ ] **7.16.5.1**: Write Cross-browser tests (compatibility, rendering, functionality)
- [ ] **7.16.5.2**: Implement Cross-browser Testing
- [ ] **7.16.5.3**: Add Cross-browser Testing compatibility
- [ ] **7.16.5.4**: Implement Cross-browser Testing rendering
- [ ] **7.16.5.5**: Add Cross-browser Testing functionality
- [ ] **7.16.5.6**: Create Cross-browser Testing test suite
- [ ] **Test**: Cross-browser compatibility works
- [ ] **Test**: Cross-browser rendering works
- [ ] **Test**: Cross-browser functionality works

**Phase 7.16.6: Mobile Responsiveness Testing**
- [ ] **7.16.6.1**: Write Mobile Responsiveness tests (layout, responsive, touch)
- [ ] **7.16.6.2**: Implement Mobile Responsiveness Testing
- [ ] **7.16.6.3**: Add Mobile Responsiveness Testing layout
- [ ] **7.16.6.4**: Implement Mobile Responsiveness Testing responsive design
- [ ] **7.16.6.5**: Add Mobile Responsiveness Testing touch interactions
- [ ] **7.16.6.6**: Create Mobile Responsiveness Testing test suite
- [ ] **Test**: Mobile Responsiveness layout works
- [ ] **Test**: Mobile Responsiveness responsive design works
- [ ] **Test**: Mobile Responsiveness touch interactions work

**Key Technical Requirements**:
- **Modular Architecture**: Each component must be self-contained with stories, tests, and i18n support
- **Test-First Development**: Write tests before implementing components
- **Accessibility First**: ARIA roles, keyboard navigation, screen reader support
- **i18n Integration**: Every component supports `uiId` and help mode
- **Performance Optimization**: Virtualization for large lists, debounced interactions
- **State Management**: Proper integration with shared state schemas
- **Smart Album Integration**: FilterBuilder and SmartAlbums must be tightly integrated
- **Change Detection**: Track when current state differs from loaded album
- **State Synchronization**: Maintain consistency between filter chains, source directories, and album state

**Enhanced State Management Requirements**:
- **Central State Store**: Single source of truth for filter chains, source directories, and album state
- **Change Tracking**: Detect when current state differs from loaded album
- **Update Button Logic**: Enable/disable based on unsaved changes
- **Load Confirmation**: Warn users when loading will overwrite unsaved changes
- **Source Directory Validation**: Ensure directories exist and are accessible (including network drives)
- **Album State Indicators**: Visual feedback for modified/unsaved albums
- **Error Recovery**: Graceful handling of load/save failures
- **Status Bar Integration**: Real-time status updates for all operations
- **Progress Tracking**: Progress indicators for long-running operations
- **Selection State Management**: Track file selection across all view modes
- **View State Persistence**: Maintain view state across mode switches
- **Operation State**: Track ongoing operations (scan, sync, file operations)

**Smart Album Integration Workflows**:

**Load Album Workflow**:
1. User clicks "Load" on album in SmartAlbumsTree
2. System checks for unsaved changes in current state
3. If unsaved changes exist, show confirmation dialog
4. Clear current FilterBuilder nodes and source directories
5. Reconstruct FilterBuilder from album's filter chain
6. Update source directory inputs with album's sources
7. Trigger file scan with new source directories
8. Apply filter chain to get new selection
9. Switch to Statistics view automatically
10. Refresh TagLibrary to show tags from new selection
11. Update album state indicators

**Update Album Workflow**:
1. User clicks "Update" on album in SmartAlbumsTree
2. Capture current FilterBuilder state (all nodes and connectors)
3. Capture current source directories
4. Create/update album JSON file with current state
5. Update album state indicators (remove "modified" status)
6. Show success feedback to user

**Add Album Workflow**:
1. User clicks "Add" on album in SmartAlbumsTree
2. Show name input dialog
3. Capture current FilterBuilder state and source directories
4. Create new album JSON file with provided name
5. Refresh SmartAlbumsTree to show new album
6. Update album state indicators

**Tutorials System Workflows**:

**Open Tutorials Workflow**:
1. User clicks "Tutorials" button in top-left frame
2. System opens new tab with tutorials page
3. Tutorials page loads with two-column layout
4. Left column shows list of available tutorials
5. Right column shows full GUI (initially empty or with welcome message)
6. User can select a tutorial from the list

**Run Tutorial Workflow**:
1. User selects tutorial from left column
2. Tutorial runner loads in right column with full GUI
3. System highlights first step's target element
4. Overlay shows step explanation in current UI language
5. User can click "Next" to proceed or let Playwright auto-execute
6. System progresses through steps with visual guidance
7. User can pause, skip, or exit tutorial at any time
8. On completion, system shows success feedback and suggests next tutorial

**Tutorial Step Execution**:
1. System identifies target UI element (by CSS selector or UI element ID)
2. Highlights element with overlay (if highlight: true)
3. Shows step explanation in current UI language
4. Executes action (click, type, drag, wait, verify) using Playwright
5. Waits for action to complete
6. Verifies expected result (if action is 'verify')
7. Moves to next step or waits for user input

### Workpackages: Phase 8 — React scaffold with Vite, TanStack Router, Zustand
- Vite + React + TypeScript setup
- TanStack Router configuration
- Zustand store wired to shared state schemas
- Tailwind config
- API client implementation using shared types from Phase 6
- Smoke route rendering app shell
- Acceptance: `web` dev server runs; basic navigation works

### Workpackages: Phase 9 — FilterBuilder UI and DnD to nodes

- [ ] `modules/filter/FilterBuilder` with Starting Node + dynamic connectors (and|or|and not|none)
- [ ] `FilterNodeView` with mode any/all and tag chips; drop target for TagPills/placeholders (expand on drop)
- [ ] Connector changes create/prune nodes as specified
- [ ] Stories cover empty, one-node, multi-node, pruning, keyboard Delete in node
- Acceptance: stories pass; node chain behaves per spec

### Workpackages: Phase 10 — TagLibrary UI (tabs, groups, context menus)

- [ ] Tabs: Automatic, User Defined, plus dynamic user groups
- [ ] `PlaceholderList` draggables; `UserTagList` with search and context menu; `GroupTabView`
- [ ] Keyboard Delete and context actions per three-context rules
- [ ] Stories for each tab state and context menu flows
- Acceptance: stories and component tests validate actions and focus/keyboard behavior

### Workpackages: Phase 11 — Placeholder to Selection and file apply flows

- [ ] Implement Selection panel and DnD from TagLibrary (store placeholder tokens in UI)
- [ ] Batch apply/remove selected tags to files via API; progress/toasts
- [ ] Stories for selection list and DnD; tests for apply/remove payloads
- Acceptance: selection updates reflected via API; tests green

### Workpackages: Phase 12 — UI state persistence

- [ ] Define Zod schema in `packages/shared/uiState.ts` with versioning
- [ ] Server: `GET/PUT /api/state` writes `data/ui-state.json` atomically with rotating backups
- [ ] Client: `persist.ts` subscribes to slices, debounced save; `hydrate.ts` loads + migrations
- [ ] BroadcastChannel to sync tabs; import/export/reset actions
- Acceptance: reload restores layout, filters, sources; backups rotate; tabs stay in sync

### Workpackages: Phase 13 — i18n matrix and contextual help

- [ ] Create `i18n/en/ui.json` and `i18n/de/ui.json`; loader and `useI18n(uiId)` hook
- [ ] Tooltip for `hint`; Help-mode toggle (`?`) with custom cursor and `DocPopover` for `doc`
- [ ] Script to verify all `data-uiid` exist in all languages
- [ ] Stories show RTL and language swap; tests verify text resolutions
- Acceptance: coverage script passes; help-mode suppresses clicks and shows docs

### Workpackages: Phase 14 — Smart Albums (file JSON) and refresh cycle

- [ ] CRUD endpoints over `data/albums/*.json` (atomic write + backup)
- [ ] Albums panel UI (Load/Update/Add/Delete)
- [ ] On Load or filter change: orchestrate search → aggregates; auto-switch to Statistics; refresh panes
- [ ] Signature check skips scan when sources unchanged; otherwise `scan auto`
- Acceptance: loading albums reconstructs UI; unchanged sources avoid re-scan; panes refresh

### Workpackages: Phase 15 — Tutorials and Playwright adapter

- [ ] Define `packages/shared/tutorial.ts` schema and JSON examples
- [ ] In-app `TutorialRunner` and tutorials route (left list + app canvas)
- [ ] Playwright adapter executes the same scripts for CI
- [ ] Scripts for core flows: placeholder to selection, filter chain, album load, delete semantics
- Acceptance: tutorial scripts run in-app and headless; CI smoke passes

### Workpackages: Phase 16 — Packaging (portable build)

- [ ] Build web (`web/dist`) and server (`server/dist`); include ExifTool binary and `data/`
- [ ] Package with `pkg`/`nexe` into a portable folder; start server at 127.0.0.1:5000 and open browser
- [ ] Smoke test portable on Windows; read/write to `data/` works
- Acceptance: a single folder runs the app; healthcheck and basic flows work
