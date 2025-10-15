# phoTool - Refactoring & Design Recommendations

**Date**: 2025-10-15  
**Status**: Proposed  
**Scope**: Comprehensive architectural review and improvement suggestions

> 📋 **Looking for the implementation plan?** See [`refactoring-implementation-plan.md`](./refactoring-implementation-plan.md) for step-by-step workpackages with testable acceptance criteria.

---

## Executive Summary

This document provides a thorough analysis of the phoTool codebase and proposes refactoring recommendations across architecture, code quality, testing, and operational concerns. The project demonstrates strong fundamentals with well-structured monorepo setup, clear separation of concerns via the shared package, and comprehensive testing. However, there are opportunities for improvement in dependency management, service layer architecture, error handling, and type safety.

**Priority Levels**:
- 🔴 **Critical**: Should address before production
- 🟡 **Important**: Improves maintainability and developer experience significantly
- 🟢 **Nice-to-have**: Incremental improvements for long-term quality

---

## 1. Architecture & Design Patterns

### 1.1 Service Layer - Dependency Injection 🟡

**Current State**:
- Services are instantiated inline in route handlers (`new TagsService()`)
- Some routes use lazy singleton pattern (albums, uiState) for testability
- No centralized dependency management
- Inconsistent patterns across different routes

**Issues**:
- Difficult to test with mocked dependencies
- Inconsistent lifecycle management
- Hard to swap implementations (e.g., for testing)
- Service dependencies are implicit rather than explicit
- No clear initialization order

**Recommendation**:
Implement a lightweight dependency injection container or factory pattern:

```typescript
// server/src/container.ts
export class ServiceContainer {
  private static instance: ServiceContainer;
  private services = new Map<string, unknown>();
  
  static getInstance(): ServiceContainer {
    if (!this.instance) {
      this.instance = new ServiceContainer();
    }
    return this.instance;
  }
  
  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory);
  }
  
  resolve<T>(key: string): T {
    const factory = this.services.get(key) as (() => T) | undefined;
    if (!factory) throw new Error(`Service ${key} not registered`);
    return factory();
  }
  
  reset(): void {
    this.services.clear();
  }
}

// Usage in routes
export function createTagsRouter(container = ServiceContainer.getInstance()) {
  const router = Router();
  const service = container.resolve<TagsService>('tagsService');
  // ...
}
```

**Benefits**:
- Centralized service configuration
- Easy mocking in tests
- Clear dependency graph
- Better support for service composition
- Simplified testing with container.reset()

---

### 1.2 Repository Pattern for Data Access 🟡

**Current State**:
- Services directly use Drizzle ORM and raw SQL
- Database logic mixed with business logic
- Direct imports of `db` client throughout services

**Issues**:
- Hard to test business logic without database
- Cannot easily swap persistence layer
- Difficult to optimize queries globally
- No clear abstraction boundary

**Recommendation**:
Introduce repository layer between services and database:

```typescript
// server/src/repositories/TagRepository.ts
export interface TagRepository {
  findAll(): Promise<Tag[]>;
  findById(id: number): Promise<Tag | null>;
  create(data: CreateTagInput): Promise<Tag>;
  update(id: number, data: UpdateTagInput): Promise<void>;
  delete(id: number): Promise<void>;
}

export class DrizzleTagRepository implements TagRepository {
  constructor(private readonly db: typeof import('../db/client.js').db) {}
  
  async findAll(): Promise<Tag[]> {
    return await this.db.select().from(tags);
  }
  // ...
}

// In tests, use InMemoryTagRepository
```

**Benefits**:
- Clear separation of concerns
- Easier unit testing with in-memory implementations
- Centralized query optimization
- Future-proof for database migration
- Better transaction management

---

### 1.3 Router Factory Pattern Consistency 🟢

**Current State**:
- Most routes use `createXRouter()` factory pattern
- `placeholdersRouter` is a pre-instantiated Router
- Inconsistent parameter handling (some use config, some use services)

**Recommendation**:
Standardize all routers to use factory pattern:

```typescript
// server/src/routes/placeholders.ts
export function createPlaceholdersRouter(
  service = placeholderResolverService
): Router {
  const router = Router();
  
  router.post('/api/expand-placeholder', async (req, res, next) => {
    // ...existing logic
  });
  
  return router;
}
```

**Benefits**:
- Consistent patterns across codebase
- Easier testing with dependency injection
- Clearer initialization flow

---

## 2. Type Safety & Error Handling

### 2.1 Enhanced Error Handling 🔴

**Current State**:
- Basic `AppError` interface with status and code
- Inconsistent error handling across routes
- Some routes catch errors, some don't
- Error responses lack structure

**Issues**:
- No error hierarchy or categorization
- Difficult to handle errors consistently
- Limited context for debugging
- No error tracking/monitoring integration points

**Recommendation**:
Implement comprehensive error hierarchy:

```typescript
// server/src/errors.ts
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  readonly timestamp = new Date().toISOString();
  readonly context?: Record<string, unknown>;
  
  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.context = context;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      status: this.status,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = 'CONFLICT';
}

export class InternalError extends AppError {
  readonly status = 500;
  readonly code = 'INTERNAL_ERROR';
}

export class ExternalServiceError extends AppError {
  readonly status = 502;
  readonly code = 'EXTERNAL_SERVICE_ERROR';
}
```

**Enhanced Error Handler**:
```typescript
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, context: err.context }, err.message);
    } else {
      logger.warn({ err, context: err.context }, err.message);
    }
    return res.status(err.status).json(err.toJSON());
  }
  
  if (err instanceof ZodError) {
    logger.warn({ err, issues: err.issues }, 'Validation error');
    return res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      issues: err.issues,
    });
  }
  
  // Unknown error
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
```

---

### 2.2 Stricter Type Checking in Routes 🟡

**Current State**:
- Route parameters extracted with `Number(req.params.id)`
- Manual validation with `Number.isFinite()` checks
- Type assertions without runtime checks
- Inconsistent error responses

**Recommendation**:
Create typed route parameter validators:

```typescript
// server/src/middleware/validation.ts
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export function validateParams<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      throw new ValidationError('Invalid route parameters', {
        issues: result.error.issues,
      });
    }
    req.params = result.data;
    next();
  };
}

// Usage
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
  const id = req.params.id; // Type-safe number
  // ...
});
```

---

### 2.3 Discriminated Unions for Request/Response Types 🟢

**Current State**:
- Some types use optional fields for different modes
- Runtime checks needed to determine type variants

**Recommendation**:
Use discriminated unions for clearer type safety:

```typescript
// packages/shared/src/contracts/library.ts
export type LibraryDeleteRequest =
  | { mode: 'group-unlink'; groupId: number; tagIds: number[] }
  | { mode: 'selection-remove'; tagIds: number[]; fileIds: number[]; filter?: FilterChain };

// In service
async delete(request: LibraryDeleteRequest): Promise<void> {
  switch (request.mode) {
    case 'group-unlink':
      return this.groupUnlink(request.groupId, request.tagIds);
    case 'selection-remove':
      return this.selectionRemove(request.tagIds, request.fileIds, request.filter);
    default:
      const _exhaustive: never = request;
      throw new Error(`Unknown mode: ${_exhaustive}`);
  }
}
```

---

## 3. Code Organization & Structure

### 3.1 Consolidate Database Client Configuration 🟡

**Current State**:
- Database client instantiated in `db/client.ts`
- Database path configuration in `db/config.ts`
- Migration logic separate
- No connection pooling or lifecycle management

**Recommendation**:
Create unified database module with lifecycle management:

```typescript
// server/src/db/index.ts
export class DatabaseManager {
  private static db: ReturnType<typeof drizzle> | null = null;
  private static sqlite: Database | null = null;
  
  static async initialize(config?: { path?: string; migrate?: boolean }) {
    if (this.db) return this.db;
    
    const dbPath = config?.path ?? getDatabaseFilePath();
    this.sqlite = new Database(dbPath);
    this.db = drizzle(this.sqlite);
    
    if (config?.migrate !== false) {
      await this.runMigrations();
    }
    
    return this.db;
  }
  
  static getClient() {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }
  
  static async close() {
    this.sqlite?.close();
    this.db = null;
    this.sqlite = null;
  }
  
  private static async runMigrations() {
    // Migration logic
  }
}
```

---

### 3.2 Feature-Based Folder Structure 🟢

**Current State**:
- Organized by technical concern (routes/, services/, db/schema/)
- Related code spread across multiple directories
- Growing file count in each directory

**Recommendation** (for future growth):
Consider feature-based organization for better cohesion:

```
server/src/
  features/
    tags/
      tags.repository.ts
      tags.service.ts
      tags.routes.ts
      tags.types.ts
      tags.test.ts
    albums/
      albums.repository.ts
      albums.service.ts
      albums.routes.ts
      albums.types.ts
      albums.test.ts
  shared/
    db/
    errors/
    middleware/
  app.ts
  index.ts
```

**Note**: This is a larger refactor - consider for Phase 7+

---

### 3.3 Centralize Configuration Management 🟡

**Current State**:
- Config loaded via `loadConfig()` called in multiple places
- No caching or singleton pattern
- Config validation happens per-load
- Environment-specific overrides not well-supported

**Recommendation**:

```typescript
// server/src/config/index.ts
export class ConfigManager {
  private static instance: AppConfig | null = null;
  
  static load(path?: string): AppConfig {
    if (!this.instance) {
      this.instance = loadConfigFromFile(path);
    }
    return this.instance;
  }
  
  static reload(path?: string): AppConfig {
    this.instance = null;
    return this.load(path);
  }
  
  static get(): AppConfig {
    if (!this.instance) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.instance;
  }
  
  static getOrLoad(path?: string): AppConfig {
    return this.instance ?? this.load(path);
  }
}

// In tests
afterEach(() => {
  ConfigManager.reload(); // Reset config between tests
});
```

---

## 4. Testing Improvements

### 4.1 Test Utilities and Fixtures 🟡

**Current State**:
- Basic test setup in `setup.ts`
- No shared test utilities
- Fixtures scattered or inline in tests
- Database migrations run for every test suite

**Recommendation**:
Create comprehensive test utilities:

```typescript
// server/test/utils/testDb.ts
export async function createTestDb() {
  const testDbPath = `:memory:`; // or temp file
  const db = await DatabaseManager.initialize({ 
    path: testDbPath,
    migrate: true 
  });
  return db;
}

export async function seedDatabase(db: Database, fixtures: Fixture[]) {
  // Insert test data
}

// server/test/utils/testServer.ts
export function createTestApp(overrides?: Partial<ServiceContainer>) {
  const container = new ServiceContainer();
  // Register test doubles
  return createApp({ container });
}

// server/test/fixtures/index.ts
export const testFiles = {
  image1: { path: '/test/img1.jpg', size: 1024, /* ... */ },
  image2: { path: '/test/img2.jpg', size: 2048, /* ... */ },
};

export const testTags = {
  vacation: { name: 'Vacation', slug: 'vacation', source: 'user' },
  family: { name: 'Family', slug: 'family', source: 'user' },
};
```

---

### 4.2 Integration Test Strategy 🟡

**Current State**:
- Good unit test coverage for schemas
- Some integration tests for routes
- No clear distinction between unit, integration, and e2e tests
- Tests all run together

**Recommendation**:
Separate test types with clear naming and execution:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: [
      'test/**/*.test.ts',       // Unit tests
      'test/**/*.integration.ts', // Integration tests
      'test/**/*.e2e.ts',        // E2E tests
    ],
    // Different test environments
    sequence: {
      setupFiles: 'list',
    },
  },
});

// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --include 'test/**/*.test.ts'",
    "test:integration": "vitest run --include 'test/**/*.integration.ts'",
    "test:e2e": "vitest run --include 'test/**/*.e2e.ts'",
    "test:watch": "vitest",
  }
}
```

**Test Organization**:
- `*.test.ts`: Pure unit tests (no DB, no network)
- `*.integration.ts`: Tests with DB and internal services
- `*.e2e.ts`: Full app tests with HTTP requests

---

### 4.3 Add Contract Testing 🟢

**Current State**:
- Schema validation tests exist
- No verification that server implements contracts correctly
- Client-server type drift possible

**Recommendation**:
Add contract tests to verify API compliance:

```typescript
// test/contracts/tags.contract.test.ts
describe('Tags API Contract', () => {
  it('GET /api/tags returns valid TagListResponse', async () => {
    const response = await request(app).get('/api/tags');
    expect(response.status).toBe(200);
    
    // Validate against contract schema
    const result = tagListResponseSchema.safeParse(response.body);
    expect(result.success).toBe(true);
  });
  
  it('POST /api/tags accepts valid TagCreate and returns ID', async () => {
    const validInput = { name: 'Test Tag', color: '#FF0000' };
    const response = await request(app)
      .post('/api/tags')
      .send(validInput);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(typeof response.body.id).toBe('number');
  });
});
```

---

## 5. Performance & Scalability

### 5.1 Database Query Optimization 🟡

**Current State**:
- Queries are straightforward but not optimized
- No query result caching
- N+1 query potential in some services
- No query performance monitoring

**Recommendation**:

**Add Query Logging**:
```typescript
// server/src/db/client.ts
export const db = drizzle(sqlite, {
  logger: {
    logQuery: (query, params) => {
      const duration = performance.now();
      logger.debug({ query, params, duration }, 'Database query');
    },
  },
});
```

**Identify N+1 Queries**:
```typescript
// BEFORE: N+1 query
async function getTagsWithCounts() {
  const tags = await db.select().from(tags);
  for (const tag of tags) {
    tag.count = await db.select().from(fileTags)
      .where(eq(fileTags.tagId, tag.id))
      .count();
  }
  return tags;
}

// AFTER: Single query with join
async function getTagsWithCounts() {
  return await db
    .select({
      ...tags,
      count: sql`COUNT(${fileTags.fileId})`,
    })
    .from(tags)
    .leftJoin(fileTags, eq(tags.id, fileTags.tagId))
    .groupBy(tags.id);
}
```

---

### 5.2 Caching Layer 🟢

**Current State**:
- No caching implemented
- Repeated expensive queries (geocoding, aggregations)
- Cache mentioned in plan but not implemented

**Recommendation**:
Implement simple in-memory cache for hot paths:

```typescript
// server/src/cache/index.ts
export class SimpleCache<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();
  
  constructor(private ttlMs: number = 5 * 60 * 1000) {}
  
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }
  
  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttlMs,
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Usage in geocoder
const geocodeCache = new SimpleCache<string, GeoResult>(
  30 * 60 * 1000 // 30 minutes
);
```

---

### 5.3 Request Rate Limiting 🔴

**Current State**:
- No rate limiting on API endpoints
- Potential for abuse (especially expensive operations)
- No protection against DoS

**Recommendation**:
Add rate limiting middleware:

```typescript
// server/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

export const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter limit for expensive operations
  message: 'Too many expensive requests',
});

// In app.ts
app.use('/api', apiLimiter);
app.use('/api/scan', expensiveLimiter);
app.use('/api/expand-placeholder', expensiveLimiter);
```

---

## 6. Developer Experience

### 6.1 API Documentation 🟡

**Current State**:
- No OpenAPI/Swagger documentation
- Routes documented only in code comments
- Client needs to read server code to understand API

**Recommendation**:
Add OpenAPI documentation:

```bash
npm install --save-dev @asteasolutions/zod-to-openapi
```

```typescript
// server/src/docs/openapi.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'get',
  path: '/api/tags',
  summary: 'List all tags',
  responses: {
    200: {
      description: 'List of tags',
      content: {
        'application/json': {
          schema: tagListResponseSchema,
        },
      },
    },
  },
});

export function generateOpenApiDocs() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'phoTool API',
      version: '0.1.0',
    },
  });
}

// Serve at /api/docs
app.get('/api/docs', (_req, res) => {
  res.json(generateOpenApiDocs());
});
```

---

### 6.2 Development Scripts 🟢

**Current State**:
- Basic scripts in package.json
- No convenience scripts for common tasks
- Manual database setup required

**Recommendation**:
Add helpful development scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:debug": "NODE_OPTIONS='--inspect' tsx watch src/index.ts",
    "db:reset": "rm -f data/phoTool.db && npm run db:migrate",
    "db:seed": "tsx scripts/seed.ts",
    "db:studio": "drizzle-kit studio",
    "test:coverage": "vitest run --coverage",
    "test:debug": "vitest --inspect-brk --no-coverage",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "validate": "npm run lint && npm run typecheck && npm run test"
  }
}
```

---

### 6.3 Better Logging in Development 🟢

**Current State**:
- Pino logger configured
- Pretty printing available but not auto-enabled in dev
- No request/response logging in development

**Recommendation**:

```typescript
// server/src/logger.ts
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

// In app.ts
app.use(pinoHttp({
  logger,
  autoLogging: isDev, // Log all requests in development
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return isDev ? 'debug' : 'silent'; // Quiet success logs in production
  },
}));
```

---

## 7. Security Improvements

### 7.1 Input Sanitization 🔴

**Current State**:
- Zod validation for request bodies
- Path normalization in scanner
- No XSS protection for user-generated content
- No SQL injection protection beyond ORM

**Recommendation**:

```typescript
// server/src/middleware/sanitization.ts
import createDOMPurify from 'isomorphic-dompurify';

const DOMPurify = createDOMPurify();

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  });
}

export function sanitizePath(inputPath: string): string {
  const normalized = path.normalize(inputPath);
  if (normalized.includes('..')) {
    throw new ValidationError('Path traversal not allowed');
  }
  return normalized;
}
```

---

### 7.2 Security Headers 🔴

**Current State**:
- No security headers configured
- Basic Express app without hardening

**Recommendation**:

```bash
npm install helmet
```

```typescript
// server/src/app.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // For inline styles
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'], // For thumbnails
    },
  },
  crossOriginEmbedderPolicy: false, // Allow cross-origin resources
}));
```

---

### 7.3 Secrets Management 🟡

**Current State**:
- Configuration in JSON file
- No secrets management strategy
- API keys would be in config file

**Recommendation**:

```typescript
// server/src/config/secrets.ts
export function loadSecret(key: string): string {
  // 1. Try environment variable
  const envValue = process.env[key];
  if (envValue) return envValue;
  
  // 2. Try secrets file (not in git)
  const secretsPath = path.join(process.cwd(), '.secrets.json');
  if (fs.existsSync(secretsPath)) {
    const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    if (secrets[key]) return secrets[key];
  }
  
  // 3. Fail for required secrets
  throw new Error(`Required secret ${key} not found`);
}

// .gitignore
.secrets.json

// .secrets.example.json (commit this)
{
  "GEOCODING_API_KEY": "your-api-key-here"
}
```

---

## 8. Code Quality & Maintainability

### 8.1 Reduce Code Duplication in Routes 🟡

**Current State**:
- Similar validation and error handling patterns repeated across routes
- ID parsing logic duplicated
- Response formatting inconsistent

**Recommendation**:
Create reusable route utilities:

```typescript
// server/src/utils/routeHelpers.ts
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return asyncHandler(async (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError('Invalid request body', {
        issues: result.error.issues,
      });
    }
    req.body = result.data;
    next();
  });
}

// Usage
router.post(
  '/',
  validateBody(tagCreateSchema),
  asyncHandler(async (req, res) => {
    const tag = await service.create(req.body);
    res.status(201).json({ id: tag.id });
  })
);
```

---

### 8.2 Improve Type Exports from Shared Package 🟡

**Current State**:
- Barrel export in `packages/shared/src/index.ts`
- All exports in one file (45+ export statements)
- Potential for circular dependencies
- Unclear what's public API

**Recommendation**:
Structure exports more deliberately:

```typescript
// packages/shared/src/index.ts
// Core types
export type { Brand, UIElementId, SampleType } from './types.js';

// Database schemas
export * from './db/index.js';

// API contracts
export * from './contracts/index.js';

// Ports (interfaces)
export * from './ports/index.js';

// Utilities
export * from './filters.js';
export * from './config.js';

// Re-export specific items to control public API
export { tagListResponseSchema, type TagListResponse } from './contracts/tags.js';
```

---

### 8.3 Add JSDoc Comments for Public APIs 🟢

**Current State**:
- Minimal code documentation
- Function purpose often unclear without reading implementation
- No type documentation

**Recommendation**:
Add JSDoc to all public APIs:

```typescript
/**
 * Service for managing photo tags.
 * 
 * Tags can be user-created or automatically generated from metadata.
 * All tag operations are persisted to the database and can trigger
 * XMP sidecar updates based on sync configuration.
 * 
 * @example
 * ```ts
 * const service = new TagsService();
 * const tag = await service.create({ name: 'Vacation', color: '#FF0000' });
 * ```
 */
export class TagsService {
  /**
   * Lists all tags in the system.
   * 
   * @returns Promise resolving to all tags with their metadata
   * @throws {InternalError} If database query fails
   */
  async list(): Promise<TagListResponse> {
    // ...
  }
}
```

---

## 9. Operational Concerns

### 9.1 Health Check Improvements 🟡

**Current State**:
- Basic health check returns `{ ok: true }`
- No dependency health checks
- No readiness vs liveness distinction

**Recommendation**:
Enhanced health checks:

```typescript
// server/src/routes/health.ts
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    database: { status: string; latency?: number };
    exiftool: { status: string; version?: string };
    filesystem: { status: string; writable?: boolean };
  };
}

router.get('/health', async (req, res) => {
  const checks = await runHealthChecks();
  const status = determineOverallHealth(checks);
  
  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    version: appMeta.version,
    uptime: process.uptime(),
    checks,
  });
});

router.get('/ready', async (req, res) => {
  // Kubernetes readiness probe
  const isReady = await checkReadiness();
  res.status(isReady ? 200 : 503).json({ ready: isReady });
});
```

---

### 9.2 Graceful Shutdown 🔴

**Current State**:
- Server starts but no shutdown handling
- ExifTool stay_open process may not close cleanly
- Database connections not closed
- In-flight requests not waited for

**Recommendation**:

```typescript
// server/src/index.ts
let server: http.Server;

async function start() {
  const app = createApp();
  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server started');
  });
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown initiated');
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close ExifTool
  await exiftoolService.end();
  
  // Close database
  await DatabaseManager.close();
  
  // Wait for existing requests (with timeout)
  await Promise.race([
    new Promise(resolve => setTimeout(resolve, 10000)),
    new Promise(resolve => server.on('close', resolve)),
  ]);
  
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch(err => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
```

---

### 9.3 Monitoring and Metrics 🟢

**Current State**:
- Logging via Pino
- No metrics collection
- No performance monitoring

**Recommendation**:
Add basic metrics:

```typescript
// server/src/monitoring/metrics.ts
export class Metrics {
  private static counters = new Map<string, number>();
  private static gauges = new Map<string, number>();
  
  static increment(metric: string, value = 1): void {
    const current = this.counters.get(metric) ?? 0;
    this.counters.set(metric, current + value);
  }
  
  static gauge(metric: string, value: number): void {
    this.gauges.set(metric, value);
  }
  
  static getAll() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
    };
  }
}

// Usage
Metrics.increment('api.tags.created');
Metrics.gauge('db.pool.size', poolSize);

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.json(Metrics.getAll());
});
```

---

## 10. Future-Proofing

### 10.1 API Versioning Strategy 🟢

**Current State**:
- No API versioning
- Breaking changes would affect all clients

**Recommendation**:
Plan for API versioning:

```typescript
// server/src/app.ts
import { createV1Router } from './routes/v1/index.js';

app.use('/api/v1', createV1Router());
app.use('/api', createV1Router()); // Default to v1 for now

// Future: /api/v2 with breaking changes
```

---

### 10.2 Event System for Extensibility 🟢

**Current State**:
- Direct service calls
- No hooks or events
- Hard to extend behavior

**Recommendation**:
Add simple event emitter:

```typescript
// server/src/events/index.ts
import { EventEmitter } from 'node:events';

export const appEvents = new EventEmitter();

export enum AppEvent {
  TAG_CREATED = 'tag:created',
  TAG_UPDATED = 'tag:updated',
  FILE_SCANNED = 'file:scanned',
  ALBUM_LOADED = 'album:loaded',
}

// In service
async create(input: CreateTagInput) {
  const tag = await this.repo.create(input);
  appEvents.emit(AppEvent.TAG_CREATED, { tag });
  return tag;
}

// Extensions can listen
appEvents.on(AppEvent.TAG_CREATED, async (data) => {
  await syncToExif(data.tag);
});
```

---

## 11. Implementation Priority

### Phase 1 (Critical - Do Before Production) 🔴
1. Enhanced error handling and hierarchy
2. Security headers (Helmet)
3. Rate limiting
4. Graceful shutdown
5. Input sanitization

### Phase 2 (Important - Improves Quality) 🟡
1. Dependency injection container
2. Repository pattern
3. Configuration management singleton
4. Health check improvements
5. API documentation (OpenAPI)
6. Test utilities and fixtures

### Phase 3 (Nice-to-Have - Incremental Improvements) 🟢
1. Feature-based folder structure
2. Caching layer
3. Metrics and monitoring
4. Event system
5. API versioning
6. Developer convenience scripts

---

## 12. Migration Strategy

For each refactoring:

1. **Create ADR**: Document the decision and rationale
2. **Write Tests First**: Ensure current behavior is captured
3. **Incremental Changes**: Refactor one service/route at a time
4. **Parallel Implementation**: Run old and new code side-by-side initially
5. **Feature Flags**: Use environment variables to toggle between implementations
6. **Validation**: Compare outputs between old and new implementations
7. **Cleanup**: Remove old code after validation period

Example:
```typescript
// Feature flag approach
const USE_NEW_TAG_SERVICE = process.env.USE_NEW_TAG_SERVICE === 'true';

export function createTagsRouter() {
  const service = USE_NEW_TAG_SERVICE 
    ? container.resolve<ITagsService>('tagsService')
    : new TagsService();
  // ...
}
```

---

## 13. Metrics for Success

Track these metrics to validate improvements:

- **Code Quality**:
  - Test coverage (target: >80%)
  - Type coverage (no `any` types except in typed catch blocks)
  - ESLint warnings (target: 0)
  - Dependency cruiser violations (target: 0)

- **Performance**:
  - API response time p95 (target: <200ms for reads, <1s for writes)
  - Database query time (target: <50ms for most queries)
  - Memory usage stability (no leaks)

- **Reliability**:
  - Error rate (target: <0.1% of requests)
  - Uptime (target: >99.9%)
  - Successful graceful shutdowns (target: 100%)

- **Developer Experience**:
  - Test execution time (target: <30s for unit tests)
  - Build time (target: <10s)
  - Time to onboard new developer (target: <4 hours to first contribution)

---

## 14. Conclusion

The phoTool project has a solid foundation with good separation of concerns, comprehensive testing, and clear documentation. The recommendations in this document focus on:

1. **Improving testability** through dependency injection and repository pattern
2. **Enhancing reliability** through better error handling and graceful shutdown
3. **Increasing security** through input validation, rate limiting, and security headers
4. **Boosting developer productivity** through better tooling and documentation
5. **Preparing for scale** through caching, monitoring, and performance optimization

These improvements can be implemented incrementally without disrupting current development. Prioritize the critical items for production readiness, then systematically work through the important and nice-to-have items based on team capacity and product needs.

The codebase shows strong adherence to established principles documented in `Rules.md` and `phoTool.plan.md`. The refactoring suggestions aim to strengthen these existing patterns while addressing gaps in error handling, testability, and operational concerns.

---

## Appendix: Quick Wins (1-2 hours each)

These can be implemented quickly for immediate benefit:

1. ✅ Add `asyncHandler` utility to reduce boilerplate
2. ✅ Implement `ConfigManager` singleton
3. ✅ Add security headers with Helmet
4. ✅ Create typed route parameter validator
5. ✅ Add development logging improvements
6. ✅ Implement graceful shutdown
7. ✅ Add basic health check for database
8. ✅ Create test fixtures file
9. ✅ Add API request rate limiting
10. ✅ Improve error response consistency

Start with these to build momentum before tackling larger architectural changes.
