import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client.js';
import { logger } from '../logger.js';

async function run() {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });
  logger.info({ migrationsFolder }, 'Database migrations applied');
}

run().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exitCode = 1;
});


