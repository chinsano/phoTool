import { integer, real, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const files = sqliteTable(
  'files',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    path: text('path').notNull(),
    dir: text('dir').notNull(),
    name: text('name').notNull(),
    ext: text('ext').notNull(),
    size: integer('size').notNull(),
    mtime: integer('mtime').notNull(),
    ctime: integer('ctime').notNull(),
    width: integer('width'),
    height: integer('height'),
    duration: real('duration'),
    lat: real('lat'),
    lon: real('lon'),
    takenAt: text('taken_at'),
    xmpPath: text('xmp_path'),
    xmpMtime: integer('xmp_mtime'),
    lastIndexedAt: text('last_indexed_at'),
  },
  (t) => ({
    filesPathUnique: uniqueIndex('files_path_unique').on(t.path),
    filesDirIdx: index('files_dir_idx').on(t.dir),
    filesExtNameIdx: index('files_ext_name_idx').on(t.ext, t.name),
  })
);


