import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import { db } from './client.js';
import { logger } from '../logger.js';

async function run() {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  // Always use in-memory DB on CI to avoid clashing with any persisted DB
  const useTemp = String(process.env.CI).toLowerCase() === 'true';
  const sqlite = useTemp ? new Database(':memory:') : null;
  const client = sqlite ? drizzle(sqlite) : db;
  try {
    await migrate(client, { migrationsFolder });
    logger.info({ migrationsFolder, temp: useTemp }, 'Database migrations applied');
  } catch (err) {
    // Fallback: if persistent DB already contains base tables without migration meta, validate migrations in-memory
    const msg = (err as Error)?.message || '';
    if (!useTemp && /already exists/i.test(msg)) {
      const mem = new Database(':memory:');
      const memClient = drizzle(mem);
      await migrate(memClient, { migrationsFolder });
      logger.warn({ migrationsFolder }, 'Persistent DB already had tables; validated migrations against in-memory DB instead');
      return;
    }
    throw err;
  }
}

run().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exitCode = 1;
});


