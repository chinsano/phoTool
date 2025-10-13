import { and, eq, inArray } from 'drizzle-orm';

import { filesSearchRequestSchema, type FilterChain } from '@phoTool/shared';
import { db } from '../db/client.js';
import { tagGroupItems } from '../db/schema/index.js';
import { QueryService } from './query.js';
import { TagApplicationService } from './tagApplication.js';

export class LibraryService {
  private readonly tagApply = new TagApplicationService();
  private readonly query = new QueryService();

  async groupUnlink(groupId: number, tagIds: number[]): Promise<void> {
    await db
      .delete(tagGroupItems)
      .where(and(eq(tagGroupItems.groupId, groupId), inArray(tagGroupItems.tagId, tagIds)));
  }

  async selectionRemove(tagIds: number[], fileIds?: number[], filter?: FilterChain): Promise<void> {
    let ids = fileIds ?? [];
    if (!ids.length && filter) {
      const req = { filter, page: { limit: 10000, offset: 0 } };
      const res = await this.query.searchFiles(req as any);
      ids = res.items.map((i) => i.id);
    }
    if (!ids.length) return;
    await this.tagApply.applyToFiles({ fileIds: ids, mode: 'remove', tagIds });
  }
}


