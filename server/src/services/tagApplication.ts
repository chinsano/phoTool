import { and, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { fileTags } from '../db/schema/index.js';

export class TagApplicationService {
  async applyToFile(input: { fileId: number; mode: 'add' | 'remove' | 'set'; tagIds: number[] }) {
    await this.apply({ fileIds: [input.fileId], mode: input.mode, tagIds: input.tagIds });
  }

  async applyToFiles(input: { fileIds: number[]; mode: 'add' | 'remove' | 'set'; tagIds: number[] }) {
    await this.apply(input);
  }

  private async apply(input: { fileIds: number[]; mode: 'add' | 'remove' | 'set'; tagIds: number[] }) {
    const { fileIds, mode, tagIds } = input;
    if (mode === 'set') {
      // Remove all provided tagIds from fileIds first (idempotent), then add
      for (const fileId of fileIds) {
        for (const tagId of tagIds) {
          await db.delete(fileTags).where(and(eq(fileTags.fileId, fileId), eq(fileTags.tagId, tagId)));
        }
      }
      for (const fileId of fileIds) {
        for (const tagId of tagIds) {
          try {
            await db.insert(fileTags).values({ fileId, tagId });
          } catch {
            // ignore duplicate
          }
        }
      }
      return;
    }

    if (mode === 'add') {
      for (const fileId of fileIds) {
        for (const tagId of tagIds) {
          try {
            await db.insert(fileTags).values({ fileId, tagId });
          } catch {
            // ignore duplicate
          }
        }
      }
      return;
    }

    // remove
    for (const fileId of fileIds) {
      for (const tagId of tagIds) {
        await db.delete(fileTags).where(and(eq(fileTags.fileId, fileId), eq(fileTags.tagId, tagId)));
      }
    }
  }
}


