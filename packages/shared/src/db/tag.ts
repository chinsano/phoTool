import { z } from 'zod';

export const tagSourceSchema = z.enum(['user', 'auto']);

export const tagRowSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  slug: z.string().min(1),
  color: z.string().min(1).nullable(),
  group: z.string().min(1).nullable(),
  parent_id: z.number().int().nonnegative().nullable(),
  source: tagSourceSchema,
});

export type TagRow = z.infer<typeof tagRowSchema>;


