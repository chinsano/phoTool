import { sql } from 'drizzle-orm';

import { db } from './client.js';
import { logger } from '../logger.js';

async function run() {
  // Simple select to verify DB opens and Drizzle can execute
  const rows = await db.all(sql`select 1 as ok`);
  logger.info({ rows }, 'DB smoke query ok');
}

run().catch((err) => {
  logger.error({ err }, 'DB smoke failed');
  process.exitCode = 1;
});


