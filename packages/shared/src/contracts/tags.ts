import { z } from 'zod';

import { tagRowSchema } from '../db/tag.js';

export const tagCreateSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1).nullable().optional(),
  parent_id: z.number().int().nonnegative().nullable().optional(),
});
export type TagCreate = z.infer<typeof tagCreateSchema>;

export const tagUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).nullable().optional(),
});
export type TagUpdate = z.infer<typeof tagUpdateSchema>;

export const tagListResponseSchema = z.object({
  tags: z.array(tagRowSchema),
});
export type TagListResponse = z.infer<typeof tagListResponseSchema>;


