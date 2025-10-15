import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { tags } from '../db/schema/index.js';
import { ConflictError, NotFoundError } from '../errors.js';

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
    
    // Check for duplicate slug
    const existing = await db.select().from(tags).where(eq(tags.slug, slug));
    if (existing.length > 0) {
      throw new ConflictError(`Tag with name '${input.name}' already exists`, { slug });
    }
    
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
    return { id: row!.id };
  }

  async update(id: number, input: { name?: string; color?: string | null }) {
    // Check if tag exists
    const existing = await db.select().from(tags).where(eq(tags.id, id));
    if (existing.length === 0) {
      throw new NotFoundError(`Tag with id ${id} not found`, { id });
    }
    
    const values: Partial<typeof tags.$inferInsert> = {};
    if (typeof input.name === 'string') {
      const slug = input.name.trim().toLowerCase();
      
      // Check for duplicate slug (excluding current tag)
      const duplicates = await db.select().from(tags).where(eq(tags.slug, slug));
      const duplicate = duplicates.find(t => t.id !== id);
      if (duplicate) {
        throw new ConflictError(`Tag with name '${input.name}' already exists`, { slug });
      }
      
      values.name = input.name;
      values.slug = slug;
    }
    if ('color' in input) {
      values.color = input.color ?? null;
    }
    if (Object.keys(values).length === 0) return;
    await db.update(tags).set(values).where(eq(tags.id, id));
  }
}


