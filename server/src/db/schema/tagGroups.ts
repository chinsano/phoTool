import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';

import { tags } from './tags.js';

export const tagGroups = sqliteTable('tag_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

export const tagGroupItems = sqliteTable(
  'tag_group_items',
  {
    groupId: integer('group_id')
      .notNull()
      .references(() => tagGroups.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ name: 'tag_group_items_pk', columns: [t.groupId, t.tagId] }),
  })
);


