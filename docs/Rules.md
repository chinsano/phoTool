# phoTool Implementation Rules and Enforcement

## Principles

- Modular by default
  - Feature-first folders with public API barrels; no deep or cross-feature imports.
  - Functional core, imperative shell: pure logic in utils/selectors/services; effects only at edges.
- Clear boundaries
  - Define ports in `packages/shared/ports/*`; implement adapters in `server/services/*` and HTTP routes.
  - UI split: presentational components (pure, props-only) vs containers/hooks (data fetching, state).
- Single source of truth
  - Types and Zod schemas live in `packages/shared`; APIs and state use them end-to-end.
- Composition over configuration
  - Prefer small, composable components and hooks over mega-props.
- Accessibility and i18n first
  - Every interactive component has a `data-uiid` and ARIA role; all text from the i18n matrix.
- Test- and story-first
  - Reproduce issues via a failing test or Storybook story before fixing; add stories for all states.

## Enforcement (automated)

- TypeScript strict (when tsconfig is added): `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- ESLint (see `.eslintrc.cjs`)
  - Forbid cycles and unsafe patterns; enforce a11y and consistent type imports.
- Dependency Cruiser (see `.dependency-cruiser.cjs`)
  - Forbid `web` importing `server` and vice versa; allow both to import `packages/shared`.
- CI (see `.github/workflows/ci.yml`)
  - Lint, type-check, Storybook build, dependency rules, and tests (when the Node workspace exists).
- PR Template (see `.github/pull_request_template.md`)
  - Checklist ensures stories/tests/i18n/architecture boundaries.

## Commit and PR guidelines

- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- Prefer small PRs (≤ 300 lines changed). If larger, split into workpackages.
- PR must include stories/tests and, when design-affecting, an ADR (below).

## ADR (Architecture Decision Record) template

```
# ADR-XXXX: <Short title>

Status: Proposed | Accepted | Superseded by ADR-YYYY
Date: YYYY-MM-DD

Context
  What problem are we solving? Constraints? Alternatives?

Decision
  What did we decide? Scope and boundaries.

Consequences
  Positive: ...  Negative: ...  Follow-ups: ...

References
  Links to issues, PRs, docs
```

Store ADRs in `docs/adr/ADR-XXXX.md` and reference them in PRs.

## Contracts and types

- Define schemas with Zod in `packages/shared`; derive TS types from schemas.
- Generate OpenAPI from server routes (later) and typed client; CI fails on drift.

## Observability and errors

- Single logger (pino) with levels; no `console.*` in production code.
- Typed error codes; UI ErrorBoundary + toast surface.
- Never swallow errors; either handle or bubble to an error boundary.

## Invariants and assertions

- Use a small `invariant(condition, message)` helper (stripped in production builds).
- Exhaustive `switch` with `never` to verify unions.

## Security and safety

- Sanitize any Markdown (`doc`) before rendering.
- Normalize and validate all filesystem paths (no traversal).
- ExifTool arg allowlist; cap parallelism; timeouts on external calls.

## Performance defaults

- Virtualize large lists; cancel stale requests; debounce expensive actions.
- Use worker threads for CPU-bound work; cap ExifTool concurrency.

## PR Checklist

- [ ] Added/updated Storybook stories for new/changed components
- [ ] Wrote unit tests for logic and component tests for UI states
- [ ] Used shared types/Zod schemas; no ad-hoc DTOs
- [ ] No cross-feature imports; only via public API barrels
- [ ] Labels/hints/docs wired via `uiId` and present in all i18n files
- [ ] Components are pure; side effects live in hooks/services
- [ ] Tutorials updated or verified
- [ ] If a workaround was needed, added an ADR or performed a refactor first
- [ ] Reviewed/updated Pre-commit checklist if functionality adds new required checks

## Pre-commit checklist (local)
- General: treat all warnings as errors
- Run repo-wide lint with zero warnings: `npm run lint:ci`
- Run dependency rules: `npm run depcruise`
- Run type-check: `npm run type-check`
- Server workspace install: `npm --workspace @phoTool/server install --no-audit --no-fund`
- Shared build: `npm --workspace @phoTool/shared run build`
- Run tests: `npm run server:test` (and web tests when present)
  - Ensure shared schema/contract tests are included (under `server/test`)
- If DB schema changed: generate and migrate locally
- If decisions or scope changed: update ADRs/EHs/plan
- No `console.*` in prod code; use logger
- Clean up temporary test directories: remove all `server/tmp-*` directories before committing
- Update plan: mark relevant TODOs complete in `docs/phoTool.plan.md` (REQUIRED when touching `packages/shared/`, `server/src/`, `server/drizzle/`, or `docs/adr/`)

Local enforcement
- Pre-commit: runs lint-staged and repo-wide gates (`lint:ci`, `type-check`, `depcruise`) and blocks commit on failure; blocks commit if changes in `server/src/`, `server/drizzle/`, `packages/shared/src/`, or `docs/adr/` lack a staged update to `docs/phoTool.plan.md`.
- Pre-push: runs `lint:ci`, `depcruise`, `type-check`, builds shared, installs server deps, runs tests, and enforces the same docs plan update check vs `origin/main`.

## Atomic UI workflow ("button zoo" first)

1. Implement atomic component in `packages/ui`.
2. Add Storybook stories covering variants, sizes, disabled/loading, RTL, help-mode, and i18n swap.
3. Add tests with Testing Library/Vitest for rendering, a11y, keyboard, help-mode.
4. Only then use the component in app containers.

## Generic Button blueprint

Props:
- `uiId: UIElementId`
- `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`
- `size: 'sm' | 'md' | 'lg'`
- `icon?: ReactNode`
- `disabled?: boolean`
- `loading?: boolean`
- `onClick?: () => void`
- `type?: 'button' | 'submit' | 'reset'`

Behavior:
- Fetch `label` and `hint` from `useI18n(uiId)`; render label; set `title={hint}`.
- In help-mode, show `DocPopover` using `doc`; clicks do nothing.
- Keyboard: Enter/Space activation; `aria-busy` when loading; focus ring; respects `disabled`.
- Stable class hooks: `.btn`, `.btn--{variant}`, `.btn--{size}` only.

Stories must include: all variants/sizes; with/without icon; loading/disabled; RTL; help-mode; i18n swap.

## Ports and Adapters

- Ports: `ExifToolPort`, `ScannerPort`, `AlbumsPort`, `StatePort`, `I18nPort` (in `packages/shared`).
- Adapters: `server/services/*` implement ports; `server/routes/*` call adapters; `web` uses HTTP clients typed from shared ports.

## Error handling and logging

- Typed errors (status + code) surfaced to a toaster; no silent catches.
- Either handle an error or bubble it; never swallow.

## How to fix issues without hacks

1. Reproduce with a failing test or story.
2. Identify which rule is violated; refactor to restore the rule (ports, boundaries, composition).
3. Implement the fix in the correct layer.
4. Extend tests/stories; run full checks.

## Workpackage cadence (stop-and-test rule)

- Always break features into the smallest separately testable workpackages (target ≤ 1–2 hours).
- Each workpackage must define its acceptance checks up front (unit tests, stories/states, and/or a short Playwright script).
- Implementation loop for every workpackage:
  1) Create a small branch named `feat/<scope>-<item>`.
  2) Implement just that item with stories/tests first.
  3) Run local gates: `lint`, `type-check`, `test`, `story:build`.
  4) Stop. Manually verify in Storybook or the dev app; adjust if needed.
  5) Commit and open a PR; CI must pass before starting the next item.
- If a change exceeds 2 hours or touches multiple layers, split it before proceeding.
