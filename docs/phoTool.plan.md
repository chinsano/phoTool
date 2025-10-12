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

### To-dos

- [ ] Initialize Node+TS monorepo, linting, tsconfig paths, pnpm or npm workspaces
- [ ] Create Express server, health route, static web serving
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
