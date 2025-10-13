import { z } from 'zod';

export const tagGroupSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
});
export type TagGroup = z.infer<typeof tagGroupSchema>;

export const tagGroupCreateSchema = z.object({
  name: z.string().min(1),
});
export type TagGroupCreate = z.infer<typeof tagGroupCreateSchema>;

export const tagGroupListResponseSchema = z.object({
  groups: z.array(tagGroupSchema),
});
export type TagGroupListResponse = z.infer<typeof tagGroupListResponseSchema>;

export const tagGroupItemsChangeSchema = z.object({
  add: z.array(z.number().int().positive()).optional(),
  remove: z.array(z.number().int().positive()).optional(),
});
export type TagGroupItemsChange = z.infer<typeof tagGroupItemsChangeSchema>;


