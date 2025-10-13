import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const tags = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    color: text('color'),
    group: text('group'),
    parentId: integer('parent_id'),
    source: text('source', { enum: ['user', 'auto'] }).notNull(),
  },
  (t) => ({
    tagsSlugUnique: uniqueIndex('tags_slug_unique').on(t.slug),
    tagsParentIdx: index('tags_parent_idx').on(t.parentId),
  })
);


