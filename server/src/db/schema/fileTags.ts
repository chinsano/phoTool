import { integer, sqliteTable, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { files } from './files';
import { tags } from './tags';

export const fileTags = sqliteTable(
  'file_tags',
  {
    fileId: integer('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ name: 'file_tags_pk', columns: [t.fileId, t.tagId] }),
    tagFileIdx: index('ft_tag_file_idx').on(t.tagId, t.fileId),
  })
);


