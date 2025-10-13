import { beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { files } from '../src/db/schema/files.js';
import { tags } from '../src/db/schema/tags.js';
import { fileTags } from '../src/db/schema/fileTags.js';
import { eq } from 'drizzle-orm';

describe('DB schema constraints', () => {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  it('inserts file, tag, and links via file_tags; cascades on delete', async () => {
    const [fileId] = await db.insert(files).values({
      path: 'C:/photos/a.jpg', dir: 'C:/photos', name: 'a', ext: 'jpg',
      size: 1, mtime: 1, ctime: 1,
    }).returning({ id: files.id });

    const [tagId] = await db.insert(tags).values({
      name: 'Holiday', slug: 'holiday', source: 'user',
    }).returning({ id: tags.id });

    const fileIdVal = fileId!.id;
    const tagIdVal = tagId!.id;

    await db.insert(fileTags).values({ fileId: fileIdVal, tagId: tagIdVal });
    const linked = await db.select().from(fileTags).where(eq(fileTags.fileId, fileIdVal));
    expect(linked.length).toBe(1);

    await db.delete(files).where(eq(files.id, fileIdVal));
    const linkedAfterDelete = await db.select().from(fileTags).where(eq(fileTags.tagId, tagIdVal));
    expect(linkedAfterDelete.length).toBe(0);
  });

  it('enforces unique slug on tags', async () => {
    await db.insert(tags).values({ name: 'City', slug: 'city', source: 'auto' });
    await expect(async () => {
      await db.insert(tags).values({ name: 'City2', slug: 'city', source: 'user' });
    }).rejects.toBeTruthy();
  });
});


