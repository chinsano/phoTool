import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

describe('migrations are idempotent on fresh DB', () => {
  it('applying migrations twice on a fresh temp DB should succeed', async () => {
    const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
    const db1 = drizzle(new Database(':memory:'));
    await migrate(db1, { migrationsFolder });
    // second migrate should be a no-op and not throw
    await migrate(db1, { migrationsFolder });
    expect(true).toBe(true);
  });
});


