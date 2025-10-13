import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { beforeAll } from 'vitest';

import { db } from '../src/db/client.js';

// Run migrations once before all tests
beforeAll(async () => {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });
});

