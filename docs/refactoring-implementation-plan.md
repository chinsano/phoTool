# phoTool - Refactoring Implementation Plan

**Date**: 2025-10-15  
**Status**: Ready for Implementation  
**Related**: See [`refactoring-recommendations.md`](./refactoring-recommendations.md) for detailed rationale and architectural analysis

> 💡 **Need context on why?** The recommendations document provides comprehensive explanations, code examples, and architectural reasoning for each workpackage.

---

## Overview

This document breaks down the refactoring recommendations into small, testable workpackages. Each workpackage:
- Can be completed in 2-8 hours
- Has clear acceptance criteria
- Includes tests before and after changes
- Is independently deployable
- Builds on previous workpackages

**Progress Tracking**: Mark items as:
- `[ ]` Not started
- `[>]` In progress
- `[✓]` Complete
- `[~]` Skipped/Deferred

---

## ⚠️ IMPORTANT: Pre-Commit Checklist

**Before committing ANY workpackage**, you MUST run the full pre-commit checklist from `Rules.md`.

**Quick Command**:
```bash
./scripts/pre-commit-check.sh
```

This script runs all required checks:
1. Lint (zero warnings)
2. Dependency boundaries
3. Type checking
4. Test suite (integration, error-simulation, performance)
5. Temp directory cleanup
6. DB migration verification
7. Plan update verification
8. Console.* check
9. ADR review

**All checks must pass before committing.** See "Implementation Guidelines" section for full details.

---

## Phase 1: Critical Production Readiness (Week 1-2)

### WP-1.1: Error Handling Foundation ✅
**Priority**: 🔴 Critical  
**Estimated Time**: 3-4 hours  
**Dependencies**: None  
**Status**: ✅ COMPLETE (2025-10-15)

#### Tasks
- [✓] Create enhanced error class hierarchy
  - [✓] Define `AppError` base class with timestamp, context, toJSON
  - [✓] Create `ValidationError`, `NotFoundError`, `ConflictError` classes
  - [✓] Create `InternalError`, `ExternalServiceError` classes
  - [✓] Export all from `server/src/errors.ts`

- [✓] Update error handler middleware
  - [✓] Handle `AppError` instances with proper status codes
  - [✓] Handle `ZodError` instances consistently
  - [✓] Log errors with appropriate levels (warn vs error)
  - [✓] Return structured JSON responses

- [✓] Write tests
  - [✓] Test each error class serialization
  - [✓] Test error handler with different error types
  - [✓] Test error context preservation
  - [✓] Test error logging behavior

#### Acceptance Criteria
```bash
# All tests pass
npm --workspace @phoTool/server run test -- errors.test.ts
npm --workspace @phoTool/server run test -- middleware/errorHandler.test.ts

# Type check passes
npm run type-check

# No breaking changes to existing routes
npm --workspace @phoTool/server run test

# ✅ BEFORE COMMITTING: Run full pre-commit checklist
# See "Pre-Commit Checklist (REQUIRED)" section below
```

#### Test File Locations
- `server/test/errors.test.ts` - Error class tests
- `server/test/middleware/errorHandler.test.ts` - Middleware tests

---

### WP-1.2: Route Error Handling Migration (Part 1)
**Priority**: 🔴 Critical  
**Estimated Time**: 2-3 hours  
**Dependencies**: WP-1.1

#### Tasks
- [ ] Migrate tags routes to new error handling
  - [ ] Replace manual error responses with error throwing
  - [ ] Use `NotFoundError` for missing tags
  - [ ] Use `ConflictError` for duplicate slugs
  - [ ] Add integration tests

- [ ] Migrate health routes
  - [ ] Update health check error responses
  - [ ] Add tests

#### Acceptance Criteria
```bash
# Route tests pass with new errors
npm --workspace @phoTool/server run test -- tags.routes.test.ts
npm --workspace @phoTool/server run test -- health.test.ts

# Error responses have consistent structure
curl http://localhost:5000/api/tags/999999 | jq '.status'  # 404
curl http://localhost:5000/api/tags/999999 | jq '.code'    # "NOT_FOUND"
```

#### Files to Modify
- `server/src/routes/tags.ts`
- `server/src/routes/health.ts`
- `server/test/tags.routes.test.ts`
- `server/test/health.test.ts`

---

### WP-1.3: Route Error Handling Migration (Part 2)
**Priority**: 🔴 Critical  
**Estimated Time**: 3-4 hours  
**Dependencies**: WP-1.2

#### Tasks
- [ ] Migrate remaining routes to new error handling
  - [ ] albums routes
  - [ ] files routes
  - [ ] fileTags routes
  - [ ] library routes
  - [ ] placeholders routes
  - [ ] scan routes
  - [ ] sync routes
  - [ ] tagGroups routes
  - [ ] thumbnails routes
  - [ ] uiState routes

- [ ] Update all integration tests

#### Acceptance Criteria
```bash
# All route tests pass
npm --workspace @phoTool/server run test -- *.routes.test.ts

# Manual smoke test
npm --workspace @phoTool/server run dev &
./scripts/smoke-test-errors.sh  # Returns expected error codes
```

#### Test Coverage
- Every route should have at least one error case test
- Error responses should be validated against schema

---

### WP-1.4: Security Headers
**Priority**: 🔴 Critical  
**Estimated Time**: 2 hours  
**Dependencies**: None

#### Tasks
- [ ] Install Helmet
  ```bash
  npm --workspace @phoTool/server install helmet
  npm --workspace @phoTool/server install -D @types/helmet
  ```

- [ ] Configure Helmet middleware
  - [ ] Add to `server/src/app.ts` before routes
  - [ ] Configure CSP for static assets and API
  - [ ] Allow data: and blob: for images (thumbnails)
  - [ ] Disable embedder policy for cross-origin resources

- [ ] Test security headers
  - [ ] Create `server/test/security.test.ts`
  - [ ] Verify headers present in responses
  - [ ] Test CSP directives

#### Acceptance Criteria
```bash
# Security headers present
curl -I http://localhost:5000/api/health | grep -i "content-security-policy"
curl -I http://localhost:5000/api/health | grep -i "x-frame-options"
curl -I http://localhost:5000/api/health | grep -i "x-content-type-options"

# Tests pass
npm --workspace @phoTool/server run test -- security.test.ts
```

#### Files to Create/Modify
- `server/src/app.ts` (add helmet)
- `server/test/security.test.ts` (new)

---

### WP-1.5: Rate Limiting
**Priority**: 🔴 Critical  
**Estimated Time**: 2-3 hours  
**Dependencies**: None

#### Tasks
- [ ] Install express-rate-limit
  ```bash
  npm --workspace @phoTool/server install express-rate-limit
  ```

- [ ] Create rate limit middleware
  - [ ] Create `server/src/middleware/rateLimit.ts`
  - [ ] Define `apiLimiter` (100 req/15min)
  - [ ] Define `expensiveLimiter` (10 req/15min)
  - [ ] Configure headers and error messages

- [ ] Apply rate limits
  - [ ] Apply `apiLimiter` to `/api/*`
  - [ ] Apply `expensiveLimiter` to `/api/scan`
  - [ ] Apply `expensiveLimiter` to `/api/expand-placeholder`

- [ ] Write tests
  - [ ] Test rate limit enforcement
  - [ ] Test rate limit headers
  - [ ] Test rate limit reset

#### Acceptance Criteria
```bash
# Rate limits enforced
for i in {1..101}; do curl -s http://localhost:5000/api/health; done | grep "Too many"

# Tests pass
npm --workspace @phoTool/server run test -- middleware/rateLimit.test.ts
```

#### Files to Create/Modify
- `server/src/middleware/rateLimit.ts` (new)
- `server/src/app.ts` (apply middleware)
- `server/test/middleware/rateLimit.test.ts` (new)

---

### WP-1.6: Graceful Shutdown
**Priority**: 🔴 Critical  
**Estimated Time**: 2-3 hours  
**Dependencies**: None

#### Tasks
- [ ] Create shutdown handler
  - [ ] Update `server/src/index.ts`
  - [ ] Handle SIGTERM and SIGINT
  - [ ] Close HTTP server (stop accepting connections)
  - [ ] Wait for in-flight requests (with timeout)
  - [ ] Close ExifTool service
  - [ ] Close database connection
  - [ ] Log shutdown progress

- [ ] Test shutdown
  - [ ] Create `server/test/shutdown.integration.test.ts`
  - [ ] Test signal handling
  - [ ] Test resource cleanup
  - [ ] Test timeout behavior

#### Acceptance Criteria
```bash
# Manual test
npm --workspace @phoTool/server run dev &
PID=$!
sleep 2
kill -TERM $PID
# Should see: "Shutdown initiated", "HTTP server closed", "Shutdown complete"

# Integration tests pass
npm --workspace @phoTool/server run test -- shutdown.integration.test.ts
```

#### Files to Modify/Create
- `server/src/index.ts` (add shutdown handlers)
- `server/src/db/client.ts` (add close method)
- `server/src/services/exiftool/index.ts` (ensure end() method)
- `server/test/shutdown.integration.test.ts` (new)

---

### WP-1.7: Input Sanitization
**Priority**: 🔴 Critical  
**Estimated Time**: 3 hours  
**Dependencies**: None

#### Tasks
- [ ] Install sanitization library
  ```bash
  npm --workspace @phoTool/server install isomorphic-dompurify
  ```

- [ ] Create sanitization utilities
  - [ ] Create `server/src/utils/sanitization.ts`
  - [ ] Implement `sanitizeHtml()` function
  - [ ] Implement `sanitizePath()` function
  - [ ] Add path traversal checks

- [ ] Apply sanitization
  - [ ] Sanitize file paths in scanner service
  - [ ] Sanitize any HTML content (future user notes)
  - [ ] Validate all user-provided paths

- [ ] Write tests
  - [ ] Test HTML sanitization
  - [ ] Test path traversal prevention
  - [ ] Test path normalization

#### Acceptance Criteria
```bash
# Tests pass
npm --workspace @phoTool/server run test -- utils/sanitization.test.ts

# Path traversal blocked
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"roots":["../../../etc/passwd"]}' \
# Should return 400 ValidationError
```

#### Files to Create/Modify
- `server/src/utils/sanitization.ts` (new)
- `server/src/services/scanner/fs.ts` (add sanitization)
- `server/test/utils/sanitization.test.ts` (new)

---

## Phase 2: Architecture Improvements (Week 3-4)

### WP-2.1: Async Handler Utility
**Priority**: 🟡 Important  
**Estimated Time**: 1 hour  
**Dependencies**: WP-1.2

#### Tasks
- [ ] Create route utilities
  - [ ] Create `server/src/utils/routeHelpers.ts`
  - [ ] Implement `asyncHandler()` wrapper
  - [ ] Implement `validateBody()` middleware factory
  - [ ] Implement `validateParams()` middleware factory

- [ ] Write tests
  - [ ] Test async error handling
  - [ ] Test validation middleware
  - [ ] Test error propagation

- [ ] Document usage with examples

#### Acceptance Criteria
```bash
# Tests pass
npm --workspace @phoTool/server run test -- utils/routeHelpers.test.ts

# Type safety verified
npm run type-check
```

#### Files to Create
- `server/src/utils/routeHelpers.ts` (new)
- `server/test/utils/routeHelpers.test.ts` (new)

---

### WP-2.2: Refactor One Route with Utilities
**Priority**: 🟡 Important  
**Estimated Time**: 1 hour  
**Dependencies**: WP-2.1

#### Tasks
- [ ] Refactor tags route
  - [ ] Replace try-catch with `asyncHandler`
  - [ ] Use `validateBody(tagCreateSchema)`
  - [ ] Use `validateParams(idParamSchema)`
  - [ ] Remove boilerplate error handling

- [ ] Verify tests still pass
- [ ] Compare before/after line count

#### Acceptance Criteria
```bash
# All tags route tests pass
npm --workspace @phoTool/server run test -- tags.routes.test.ts

# Reduced code duplication (measure LOC)
git diff --stat server/src/routes/tags.ts
```

#### Files to Modify
- `server/src/routes/tags.ts`
- `server/test/tags.routes.test.ts` (verify)

---

### WP-2.3: Apply Route Utilities to All Routes
**Priority**: 🟡 Important  
**Estimated Time**: 3-4 hours  
**Dependencies**: WP-2.2

#### Tasks
- [ ] Refactor remaining routes (one at a time)
  - [ ] aggregations.ts
  - [ ] albums.ts
  - [ ] files.ts
  - [ ] fileTags.ts
  - [ ] library.ts
  - [ ] placeholders.ts
  - [ ] scan.ts
  - [ ] sync.ts
  - [ ] tagGroups.ts
  - [ ] thumbnails.ts
  - [ ] uiState.ts

- [ ] Verify all tests pass after each refactor

#### Acceptance Criteria
```bash
# All route tests pass
npm --workspace @phoTool/server run test -- *.routes.test.ts

# Consistent pattern across all routes
grep -r "asyncHandler" server/src/routes/ | wc -l  # Should be many
grep -r "try {" server/src/routes/ | wc -l  # Should be few/none
```

---

### WP-2.4: Configuration Manager
**Priority**: 🟡 Important  
**Estimated Time**: 2 hours  
**Dependencies**: None

#### Tasks
- [ ] Create ConfigManager
  - [ ] Create `server/src/config/manager.ts`
  - [ ] Implement singleton pattern
  - [ ] Add `load()`, `reload()`, `get()` methods
  - [ ] Support test-specific config paths

- [ ] Replace `loadConfig()` calls
  - [ ] Update `server/src/config.ts` to use manager
  - [ ] Update all services to use `ConfigManager.get()`
  - [ ] Update tests to use `ConfigManager.reload()`

- [ ] Write tests
  - [ ] Test singleton behavior
  - [ ] Test reload functionality
  - [ ] Test missing config handling

#### Acceptance Criteria
```bash
# Tests pass
npm --workspace @phoTool/server run test -- config.manager.test.ts

# Config loaded once per process
# Verify via logging or instrumentation

# All existing tests still pass
npm --workspace @phoTool/server run test
```

#### Files to Create/Modify
- `server/src/config/manager.ts` (new)
- `server/src/config.ts` (refactor)
- `server/test/config.manager.test.ts` (new)

---

### WP-2.5: Database Manager
**Priority**: 🟡 Important  
**Estimated Time**: 2-3 hours  
**Dependencies**: None

#### Tasks
- [ ] Create DatabaseManager
  - [ ] Create `server/src/db/manager.ts`
  - [ ] Implement `initialize()`, `getClient()`, `close()` methods
  - [ ] Add migration runner
  - [ ] Add connection lifecycle management

- [ ] Update db/client.ts
  - [ ] Export `DatabaseManager`
  - [ ] Keep backward-compatible `db` export initially
  - [ ] Add deprecation notice

- [ ] Update tests
  - [ ] Use `DatabaseManager.initialize()` in setup
  - [ ] Use `DatabaseManager.close()` in teardown
  - [ ] Add manager-specific tests

#### Acceptance Criteria
```bash
# Tests pass
npm --workspace @phoTool/server run test -- db.manager.test.ts

# Migration runs automatically on init
npm --workspace @phoTool/server run test

# Graceful shutdown uses close()
npm --workspace @phoTool/server run dev
# (Ctrl+C should call DatabaseManager.close())
```

#### Files to Create/Modify
- `server/src/db/manager.ts` (new)
- `server/src/db/client.ts` (refactor)
- `server/src/index.ts` (use manager)
- `server/test/setup.ts` (use manager)
- `server/test/db.manager.test.ts` (new)

---

### WP-2.6: Service Container Foundation
**Priority**: 🟡 Important  
**Estimated Time**: 3-4 hours  
**Dependencies**: WP-2.4, WP-2.5

#### Tasks
- [ ] Create ServiceContainer
  - [ ] Create `server/src/container.ts`
  - [ ] Implement `register()`, `resolve()`, `reset()` methods
  - [ ] Support lazy initialization
  - [ ] Support singleton vs transient lifetimes

- [ ] Register core services
  - [ ] Register TagsService
  - [ ] Register ConfigManager
  - [ ] Register DatabaseManager
  - [ ] Register Logger

- [ ] Write tests
  - [ ] Test service registration
  - [ ] Test service resolution
  - [ ] Test singleton behavior
  - [ ] Test container reset

#### Acceptance Criteria
```bash
# Container tests pass
npm --workspace @phoTool/server run test -- container.test.ts

# Type-safe service resolution
npm run type-check

# No runtime impact yet (not used in routes)
npm --workspace @phoTool/server run test
```

#### Files to Create
- `server/src/container.ts` (new)
- `server/test/container.test.ts` (new)

---

### WP-2.7: Migrate Tags Route to DI
**Priority**: 🟡 Important  
**Estimated Time**: 2 hours  
**Dependencies**: WP-2.6

#### Tasks
- [ ] Update tags route factory
  - [ ] Accept optional container parameter
  - [ ] Resolve TagsService from container
  - [ ] Fall back to direct instantiation if no container

- [ ] Update app.ts
  - [ ] Create and configure container
  - [ ] Pass container to createTagsRouter()

- [ ] Update tests
  - [ ] Use container with mock services
  - [ ] Verify service is called correctly
  - [ ] Test with real and mock services

#### Acceptance Criteria
```bash
# Tests pass with DI
npm --workspace @phoTool/server run test -- tags.routes.test.ts

# Manual verification
npm --workspace @phoTool/server run dev
curl http://localhost:5000/api/tags  # Works as before

# Backward compatible (container optional)
npm --workspace @phoTool/server run test
```

#### Files to Modify
- `server/src/routes/tags.ts`
- `server/src/app.ts`
- `server/test/tags.routes.test.ts`

---

### WP-2.8: Migrate Remaining Routes to DI
**Priority**: 🟡 Important  
**Estimated Time**: 4-6 hours  
**Dependencies**: WP-2.7

#### Tasks
- [ ] Migrate routes one at a time
  - [ ] albums
  - [ ] aggregations
  - [ ] files
  - [ ] fileTags
  - [ ] library
  - [ ] placeholders
  - [ ] scan
  - [ ] sync
  - [ ] tagGroups
  - [ ] thumbnails
  - [ ] uiState

- [ ] Update tests for each route
- [ ] Verify backward compatibility

#### Acceptance Criteria
```bash
# All routes use DI
grep -r "container.resolve" server/src/routes/ | wc -l  # Should match route count

# All tests pass
npm --workspace @phoTool/server run test

# Integration tests pass
npm --workspace @phoTool/server run test -- *.integration.test.ts
```

---

## Phase 3: Testing & Quality (Week 5)

### WP-3.1: Test Utilities Module
**Priority**: 🟡 Important  
**Estimated Time**: 3-4 hours  
**Dependencies**: None

#### Tasks
- [ ] Create test utilities
  - [ ] Create `server/test/utils/testDb.ts`
  - [ ] Implement `createTestDb()` helper
  - [ ] Implement `seedDatabase()` helper
  - [ ] Implement `clearDatabase()` helper

- [ ] Create test server helper
  - [ ] Create `server/test/utils/testServer.ts`
  - [ ] Implement `createTestApp()` with container
  - [ ] Implement request helpers

- [ ] Create shared fixtures
  - [ ] Create `server/test/fixtures/files.ts`
  - [ ] Create `server/test/fixtures/tags.ts`
  - [ ] Create `server/test/fixtures/albums.ts`

- [ ] Document usage

#### Acceptance Criteria
```bash
# Utilities available
ls server/test/utils/testDb.ts
ls server/test/utils/testServer.ts
ls server/test/fixtures/

# Example usage works
npm --workspace @phoTool/server run test -- utils/*.test.ts
```

#### Files to Create
- `server/test/utils/testDb.ts` (new)
- `server/test/utils/testServer.ts` (new)
- `server/test/fixtures/files.ts` (new)
- `server/test/fixtures/tags.ts` (new)
- `server/test/fixtures/albums.ts` (new)

---

### WP-3.2: Refactor Existing Tests to Use Utilities
**Priority**: 🟡 Important  
**Estimated Time**: 4-6 hours  
**Dependencies**: WP-3.1

#### Tasks
- [ ] Update route tests
  - [ ] Use `createTestApp()` instead of direct app creation
  - [ ] Use fixtures instead of inline data
  - [ ] Use `seedDatabase()` for test data

- [ ] Update service tests
  - [ ] Use `createTestDb()` for isolated tests
  - [ ] Use fixtures for input data

- [ ] Measure improvement
  - [ ] Count lines of boilerplate removed
  - [ ] Measure test execution time

#### Acceptance Criteria
```bash
# All tests pass
npm --workspace @phoTool/server run test

# Tests are more readable
git diff --stat server/test/

# Test fixtures reused across tests
grep -r "testFiles\." server/test/ | wc -l  # Should be many
```

---

### WP-3.3: Separate Test Types
**Priority**: 🟡 Important  
**Estimated Time**: 2-3 hours  
**Dependencies**: WP-3.2

#### Tasks
- [ ] Rename test files by type
  - [ ] `*.test.ts` - pure unit tests (no DB, no network)
  - [ ] `*.integration.ts` - tests with DB and internal services
  - [ ] `*.e2e.ts` - full HTTP request/response tests

- [ ] Update vitest config
  - [ ] Add separate test patterns
  - [ ] Configure test environments

- [ ] Update package.json scripts
  - [ ] Add `test:unit`, `test:integration`, `test:e2e`
  - [ ] Update CI to run separately

#### Acceptance Criteria
```bash
# Separate test commands work
npm --workspace @phoTool/server run test:unit
npm --workspace @phoTool/server run test:integration
npm --workspace @phoTool/server run test:e2e

# Fast unit tests
time npm --workspace @phoTool/server run test:unit  # < 5 seconds

# All tests still pass
npm --workspace @phoTool/server run test
```

#### Files to Modify
- `server/vitest.config.ts`
- `server/package.json`
- Rename many test files

---

### WP-3.4: Contract Tests
**Priority**: 🟢 Nice-to-have  
**Estimated Time**: 3-4 hours  
**Dependencies**: None

#### Tasks
- [ ] Create contract test suite
  - [ ] Create `server/test/contracts/api.contract.test.ts`
  - [ ] Test each endpoint against its schema
  - [ ] Verify request validation
  - [ ] Verify response schema compliance

- [ ] Add to CI
  - [ ] Run contract tests in CI
  - [ ] Fail on schema violations

#### Acceptance Criteria
```bash
# Contract tests pass
npm --workspace @phoTool/server run test -- contracts/*.contract.test.ts

# Schema violations caught
# (Manually introduce schema drift and verify test fails)
```

#### Files to Create
- `server/test/contracts/api.contract.test.ts` (new)

---

## Phase 4: Performance & Operations (Week 6)

### WP-4.1: Enhanced Health Checks
**Priority**: 🟡 Important  
**Estimated Time**: 2-3 hours  
**Dependencies**: None

#### Tasks
- [ ] Enhance health endpoint
  - [ ] Add database connectivity check
  - [ ] Add ExifTool availability check
  - [ ] Add filesystem write check
  - [ ] Return structured status

- [ ] Add readiness endpoint
  - [ ] Create `/health/ready` endpoint
  - [ ] Check critical dependencies
  - [ ] Return 503 if not ready

- [ ] Add liveness endpoint
  - [ ] Create `/health/live` endpoint
  - [ ] Simple uptime check

- [ ] Write tests

#### Acceptance Criteria
```bash
# Health checks work
curl http://localhost:5000/health | jq '.checks'
curl http://localhost:5000/health/ready | jq '.ready'
curl http://localhost:5000/health/live | jq '.alive'

# Tests pass
npm --workspace @phoTool/server run test -- health.routes.test.ts
```

#### Files to Modify
- `server/src/routes/health.ts`
- `server/test/health.routes.test.ts`

---

### WP-4.2: Request Logging Enhancement
**Priority**: 🟢 Nice-to-have  
**Estimated Time**: 1-2 hours  
**Dependencies**: None

#### Tasks
- [ ] Configure pino-http
  - [ ] Auto-log requests in development
  - [ ] Custom log levels based on status
  - [ ] Add request ID to all logs

- [ ] Test logging output
  - [ ] Verify request/response correlation
  - [ ] Verify log levels

#### Acceptance Criteria
```bash
# Request logging visible in dev
npm --workspace @phoTool/server run dev
# (Make requests and verify formatted logs)

# Tests pass
npm --workspace @phoTool/server run test
```

#### Files to Modify
- `server/src/app.ts`
- `server/src/logger.ts`

---

### WP-4.3: Basic Metrics
**Priority**: 🟢 Nice-to-have  
**Estimated Time**: 2-3 hours  
**Dependencies**: None

#### Tasks
- [ ] Create metrics module
  - [ ] Create `server/src/monitoring/metrics.ts`
  - [ ] Implement counters and gauges
  - [ ] Add `increment()`, `gauge()`, `getAll()` methods

- [ ] Add metrics endpoint
  - [ ] Create `/metrics` endpoint
  - [ ] Return JSON format

- [ ] Instrument key paths
  - [ ] Count requests by route
  - [ ] Track database query count
  - [ ] Track ExifTool operations

- [ ] Write tests

#### Acceptance Criteria
```bash
# Metrics endpoint works
curl http://localhost:5000/metrics | jq

# Metrics increment
curl http://localhost:5000/api/tags
curl http://localhost:5000/metrics | jq '.counters["api.tags.list"]'

# Tests pass
npm --workspace @phoTool/server run test -- monitoring/metrics.test.ts
```

#### Files to Create
- `server/src/monitoring/metrics.ts` (new)
- `server/test/monitoring/metrics.test.ts` (new)

---

### WP-4.4: Simple Cache Implementation
**Priority**: 🟢 Nice-to-have  
**Estimated Time**: 2-3 hours  
**Dependencies**: None

#### Tasks
- [ ] Create cache module
  - [ ] Create `server/src/cache/SimpleCache.ts`
  - [ ] Implement TTL-based cache
  - [ ] Add `get()`, `set()`, `clear()` methods
  - [ ] Add size limits

- [ ] Apply to geocoding
  - [ ] Cache geocoding results
  - [ ] Set appropriate TTL (30 minutes)

- [ ] Write tests
  - [ ] Test cache hit/miss
  - [ ] Test expiration
  - [ ] Test size limits

#### Acceptance Criteria
```bash
# Cache tests pass
npm --workspace @phoTool/server run test -- cache/SimpleCache.test.ts

# Geocoding cache works
# (Verify via logs or metrics that cache is hit)

# No memory leaks
npm --workspace @phoTool/server run test -- cache/memory.test.ts
```

#### Files to Create
- `server/src/cache/SimpleCache.ts` (new)
- `server/test/cache/SimpleCache.test.ts` (new)

---

## Phase 5: Documentation & DX (Week 7)

### WP-5.1: OpenAPI Documentation
**Priority**: 🟡 Important  
**Estimated Time**: 4-6 hours  
**Dependencies**: None

#### Tasks
- [ ] Install dependencies
  ```bash
  npm --workspace @phoTool/server install @asteasolutions/zod-to-openapi
  ```

- [ ] Create OpenAPI generator
  - [ ] Create `server/src/docs/openapi.ts`
  - [ ] Register all endpoints
  - [ ] Generate OpenAPI 3.0 spec

- [ ] Add docs endpoint
  - [ ] Serve spec at `/api/docs`
  - [ ] Add Swagger UI (optional)

- [ ] Validate spec
  - [ ] All routes documented
  - [ ] All schemas included
  - [ ] Examples provided

#### Acceptance Criteria
```bash
# OpenAPI spec available
curl http://localhost:5000/api/docs | jq '.openapi'  # "3.0.0"

# All routes documented
curl http://localhost:5000/api/docs | jq '.paths | keys | length'

# Spec is valid
npx @redocly/cli lint http://localhost:5000/api/docs
```

#### Files to Create
- `server/src/docs/openapi.ts` (new)
- `server/src/app.ts` (add docs route)

---

### WP-5.2: Developer Scripts
**Priority**: 🟢 Nice-to-have  
**Estimated Time**: 1-2 hours  
**Dependencies**: None

#### Tasks
- [ ] Add convenience scripts to package.json
  - [ ] `db:reset` - Drop and recreate DB
  - [ ] `db:seed` - Add test data
  - [ ] `db:studio` - Open Drizzle Studio
  - [ ] `test:coverage` - Run with coverage
  - [ ] `test:debug` - Debug tests
  - [ ] `validate` - Lint + typecheck + test

- [ ] Create seed script
  - [ ] Create `server/scripts/seed.ts`
  - [ ] Add sample tags, files, albums

- [ ] Document in README

#### Acceptance Criteria
```bash
# All scripts work
npm --workspace @phoTool/server run db:reset
npm --workspace @phoTool/server run db:seed
npm --workspace @phoTool/server run test:coverage
npm --workspace @phoTool/server run validate
```

#### Files to Modify/Create
- `server/package.json`
- `server/scripts/seed.ts` (new)
- `server/README.md`

---

### WP-5.3: JSDoc for Public APIs
**Priority**: 🟢 Nice-to-have  
**Estimated Time**: 4-6 hours  
**Dependencies**: None

#### Tasks
- [ ] Document service classes
  - [ ] Add class-level JSDoc
  - [ ] Add method-level JSDoc
  - [ ] Add parameter documentation
  - [ ] Add examples

- [ ] Document shared types
  - [ ] Add interface documentation
  - [ ] Add type parameter documentation
  - [ ] Add usage examples

- [ ] Configure TSDoc linting
  - [ ] Install eslint-plugin-tsdoc
  - [ ] Add to ESLint config
  - [ ] Fix violations

#### Acceptance Criteria
```bash
# TSDoc valid
npm run lint

# Documentation generated
npx typedoc --out docs/api server/src

# Examples in docs are valid
npm run type-check
```

#### Files to Modify
- All service files (add JSDoc)
- `packages/shared/src/**/*.ts` (add JSDoc)
- `eslint.config.mjs` (add tsdoc plugin)

---

## Implementation Guidelines

### Daily Workflow
1. **Pick a workpackage** from current phase
2. **Create feature branch**: `git checkout -b feat/wp-X.Y-description`
3. **Run existing tests**: Verify baseline passes
4. **Implement tasks** one at a time
5. **Write/update tests** after each task
6. **Run pre-commit checklist** (see below - REQUIRED)
7. **Verify acceptance criteria** before committing
8. **Create PR** with workpackage checklist
9. **Review and merge**

### Pre-Commit Checklist (REQUIRED - Run Before Every Commit)

From `Rules.md` - all items must pass:

```bash
# 1. Repo-wide lint (zero warnings - treat warnings as errors)
npm run lint:ci

# 2. Dependency boundaries check
npm run depcruise

# 3. Type checking
npm run type-check

# 4. Server workspace install
npm --workspace @phoTool/server install --no-audit --no-fund

# 5. Shared package build
npm --workspace @phoTool/shared run build

# 6. Run full test suite
npm run server:test
# Ensure these are included:
#   - shared.integration.test.ts
#   - shared.error-simulation.test.ts  
#   - shared.performance.test.ts

# 7. Clean up temporary test directories
rm -rf server/tmp-*

# 8. If DB schema changed: generate and migrate locally
# npm --workspace @phoTool/server run db:generate
# npm --workspace @phoTool/server run db:migrate

# 9. Update plan (REQUIRED when touching):
#    - packages/shared/
#    - server/src/
#    - server/drizzle/
#    - docs/adr/
# Mark relevant TODOs complete in docs/phoTool.plan.md

# 10. Verify no console.* in production code (except console.warn/error)
! grep -r "console\." server/src/ --exclude-dir=node_modules | grep -v "console.warn\|console.error"

# 11. Verify ADRs updated if decisions/scope changed
# (Manual review of docs/adr/)
```

**Automated Enforcement**:
- ✅ Pre-commit hook runs `lint:ci`, `type-check`, `depcruise`
- ✅ Pre-commit hook blocks commits without plan updates for relevant files
- ✅ Pre-push hook runs full test suite
- ✅ All hooks must pass to proceed

**Expected Result**: All commands exit with code 0

**💡 Quick Helper Script**: 
```bash
# Run all pre-commit checks automatically
./scripts/pre-commit-check.sh
```

---

### Testing Checklist (Per Workpackage)

**Pre-Commit Checklist** (from `Rules.md` - MUST pass before committing):

```bash
# 1. Repo-wide lint (zero warnings)
npm run lint:ci

# 2. Dependency rules
npm run depcruise

# 3. Type checking
npm run type-check

# 4. Server workspace install
npm --workspace @phoTool/server install --no-audit --no-fund

# 5. Shared package build
npm --workspace @phoTool/shared run build

# 6. Run all tests
npm run server:test

# 7. Clean up temporary test directories
rm -rf server/tmp-*

# 8. If DB schema changed: verify migrations
npm --workspace @phoTool/server run db:migrate

# 9. Update plan (REQUIRED for changes in server/src/, packages/shared/, or docs/adr/)
# Mark TODOs complete in docs/phoTool.plan.md

# 10. Verify no console.* in production code
grep -r "console\." server/src/ --exclude-dir=node_modules | grep -v "console.warn\|console.error"
# Should return nothing
```

**Additional Workpackage-Specific Tests**:

```bash
# Unit tests (if test:unit script exists)
npm --workspace @phoTool/server run test:unit

# Integration tests (if test:integration script exists)
npm --workspace @phoTool/server run test:integration

# Manual smoke test (if applicable)
npm --workspace @phoTool/server run dev
# Test affected endpoints
```

**Automated Enforcement**:
- Pre-commit hook runs `lint:ci`, `type-check`, `depcruise` automatically
- Pre-commit hook enforces plan update for relevant files
- Pre-push hook runs full test suite
- All hooks must pass to proceed

### PR Template Checklist
```markdown
## Workpackage: WP-X.Y - Title

### Tasks Completed
- [ ] Task 1
- [ ] Task 2
- [ ] ...

### Tests
- [ ] All acceptance criteria met
- [ ] New tests added: `path/to/test.ts`
- [ ] All existing tests pass
- [ ] Type checking passes
- [ ] Lint passes
- [ ] Manual testing completed

### Pre-Commit Checklist Completed
- [ ] `npm run lint:ci` ✅ (zero warnings)
- [ ] `npm run depcruise` ✅
- [ ] `npm run type-check` ✅
- [ ] `npm --workspace @phoTool/server install --no-audit --no-fund` ✅
- [ ] `npm --workspace @phoTool/shared run build` ✅
- [ ] `npm run server:test` ✅ (includes integration, error-simulation, performance)
- [ ] Temporary test directories cleaned (`server/tmp-*`)
- [ ] DB migrations generated and tested (if schema changed)
- [ ] Plan updated in `docs/phoTool.plan.md` (if required)
- [ ] No `console.*` in production code (except warn/error)
- [ ] ADRs updated (if decisions changed)

### Breaking Changes
- [ ] None
- [ ] (Or describe)

### Related
- Implements: WP-X.Y
- Depends on: WP-A.B
- Related ADR: ADR-XXXX
```

---

## Progress Tracking

### Phase 1: Critical (🔴)
- [ ] WP-1.1: Error Handling Foundation
- [ ] WP-1.2: Route Error Handling Migration (Part 1)
- [ ] WP-1.3: Route Error Handling Migration (Part 2)
- [ ] WP-1.4: Security Headers
- [ ] WP-1.5: Rate Limiting
- [ ] WP-1.6: Graceful Shutdown
- [ ] WP-1.7: Input Sanitization

### Phase 2: Architecture (🟡)
- [ ] WP-2.1: Async Handler Utility
- [ ] WP-2.2: Refactor One Route with Utilities
- [ ] WP-2.3: Apply Route Utilities to All Routes
- [ ] WP-2.4: Configuration Manager
- [ ] WP-2.5: Database Manager
- [ ] WP-2.6: Service Container Foundation
- [ ] WP-2.7: Migrate Tags Route to DI
- [ ] WP-2.8: Migrate Remaining Routes to DI

### Phase 3: Testing (🟡)
- [ ] WP-3.1: Test Utilities Module
- [ ] WP-3.2: Refactor Existing Tests to Use Utilities
- [ ] WP-3.3: Separate Test Types
- [ ] WP-3.4: Contract Tests

### Phase 4: Performance (🟢)
- [ ] WP-4.1: Enhanced Health Checks
- [ ] WP-4.2: Request Logging Enhancement
- [ ] WP-4.3: Basic Metrics
- [ ] WP-4.4: Simple Cache Implementation

### Phase 5: Documentation (🟢)
- [ ] WP-5.1: OpenAPI Documentation
- [ ] WP-5.2: Developer Scripts
- [ ] WP-5.3: JSDoc for Public APIs

---

## Success Metrics

Track these throughout implementation:

### Code Quality
- [ ] Test coverage > 80%
- [ ] Zero ESLint warnings
- [ ] Zero dependency cruiser violations
- [ ] All TypeScript strict mode enabled

### Performance
- [ ] API p95 response time < 200ms (reads)
- [ ] API p95 response time < 1s (writes)
- [ ] Zero memory leaks in 24h test

### Reliability
- [ ] Error rate < 0.1%
- [ ] Graceful shutdown success rate 100%
- [ ] All health checks pass

### Developer Experience
- [ ] Unit test suite < 10s
- [ ] Full test suite < 60s
- [ ] Time to first contribution < 4h

---

## Notes

- **Flexibility**: Workpackages can be reordered within phases if dependencies allow
- **Parallelization**: Independent workpackages can be done in parallel by team members
- **Iteration**: After each phase, review progress and adjust plan as needed
- **Documentation**: Update this plan as you complete workpackages or discover new requirements
- **ADRs**: Create ADRs for significant decisions made during implementation

---

## Related Documents

- [Detailed Recommendations](./refactoring-recommendations.md) - Full rationale and examples
- [Architecture Plan](./phoTool.plan.md) - Original architecture and features
- [Implementation Rules](./Rules.md) - Coding standards and conventions
- [ADRs](./adr/) - Architecture decision records
