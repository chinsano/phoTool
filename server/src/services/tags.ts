import { db } from '../db/client.js';
import { tags } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export class TagsService {
  async list() {
    const rows = await db.select().from(tags);
    const mapped = rows.map((r: typeof tags.$inferSelect) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      color: r.color ?? null,
      group: null,
      parent_id: r.parentId ?? null,
      source: r.source,
    }));
    return { tags: mapped };
  }

  async create(input: { name: string; color?: string | null; parent_id?: number | null }) {
    const slug = input.name.trim().toLowerCase();
    const [row] = await db
      .insert(tags)
      .values({
        name: input.name,
        slug,
        color: input.color ?? null,
        parentId: input.parent_id ?? null,
        source: 'user',
      })
      .returning({ id: tags.id });
    return { id: row.id };
  }

  async update(id: number, input: { name?: string; color?: string | null }) {
    const values: Partial<typeof tags.$inferInsert> = {};
    if (typeof input.name === 'string') {
      values.name = input.name;
      values.slug = input.name.trim().toLowerCase();
    }
    if ('color' in input) {
      values.color = input.color ?? null;
    }
    if (Object.keys(values).length === 0) return;
    await db.update(tags).set(values).where(eq(tags.id, id));
  }
}


