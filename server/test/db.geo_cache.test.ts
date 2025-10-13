import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';

import { geoCache } from '../src/db/schema/geoCache.js';

describe('DB geo_cache presence', () => {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  it('has geo_cache table and unique index', async () => {
    const [id] = await db
      .insert(geoCache)
      .values({ latRounded: 10.1, lonRounded: 20.2, precision: 3, country: 'X', state: null, city: null, source: 'offline', updatedAt: new Date().toISOString() })
      .returning({ id: geoCache.id });
    expect(id!.id).toBeDefined();

    await expect(async () => {
      await db
        .insert(geoCache)
        .values({ latRounded: 10.1, lonRounded: 20.2, precision: 3, country: 'X', state: null, city: null, source: 'offline', updatedAt: new Date().toISOString() })
        .run?.();
    }).rejects.toBeTruthy();
  });
});


