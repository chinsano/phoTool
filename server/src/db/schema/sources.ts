import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable(
  'sources',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    signature: text('signature').notNull(),
    rootsJson: text('roots_json').notNull(),
    lastScannedAt: text('last_scanned_at'),
  },
  (t) => ({
    signatureUnique: uniqueIndex('sources_signature_unique').on(t.signature),
  })
);



