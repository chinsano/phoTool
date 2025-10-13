import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const geoCache = sqliteTable(
  'geo_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    latRounded: real('lat_rounded').notNull(),
    lonRounded: real('lon_rounded').notNull(),
    precision: integer('precision').notNull(),
    country: text('country'),
    state: text('state'),
    city: text('city'),
    source: text('source'), // 'exif' | 'bigdatacloud' | 'offline' (legacy)
    updatedAt: text('updated_at'),
  },
  (t) => ({
    geoKeyUnique: uniqueIndex('geo_cache_key_unique').on(t.latRounded, t.lonRounded, t.precision),
  })
);


