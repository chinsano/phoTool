import { z } from 'zod';

export const tagApplyModeSchema = z.enum(['add', 'remove', 'set']);
export type TagApplyMode = z.infer<typeof tagApplyModeSchema>;

export const tagApplySingleSchema = z.object({
  fileId: z.number().int().positive(),
  mode: tagApplyModeSchema,
  tagIds: z.array(z.number().int().positive()).min(1),
});
export type TagApplySingle = z.infer<typeof tagApplySingleSchema>;

export const tagApplyBatchSchema = z.object({
  fileIds: z.array(z.number().int().positive()).min(1),
  mode: tagApplyModeSchema,
  tagIds: z.array(z.number().int().positive()).min(1),
});
export type TagApplyBatch = z.infer<typeof tagApplyBatchSchema>;


