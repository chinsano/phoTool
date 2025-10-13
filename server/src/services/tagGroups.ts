import { and, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { tagGroupItems, tagGroups } from '../db/schema/index.js';

export class TagGroupsService {
  async list() {
    const rows = await db.select().from(tagGroups);
    return { groups: rows };
  }

  async create(input: { name: string }) {
    const [row] = await db
      .insert(tagGroups)
      .values({ name: input.name })
      .returning({ id: tagGroups.id });
    return { id: row!.id };
  }

  async changeItems(
    groupId: number,
    change: { add?: number[]; remove?: number[] }
  ) {
    if (change.add?.length) {
      const values = change.add.map((tagId) => ({ groupId, tagId }));
      // Insert, ignore duplicates based on PK
      for (const v of values) {
        try {
          await db.insert(tagGroupItems).values(v);
        } catch {
          // ignore duplicate primary key
        }
      }
    }
    if (change.remove?.length) {
      for (const tagId of change.remove) {
        await db
          .delete(tagGroupItems)
          .where(and(eq(tagGroupItems.groupId, groupId), eq(tagGroupItems.tagId, tagId)));
      }
    }
  }
}


