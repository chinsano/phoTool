import { z } from 'zod';

import { filterChainSchema } from '../filters.js';

export const libraryDeleteModeSchema = z.enum(['group-unlink', 'selection-remove']);

export const libraryDeleteGroupUnlinkSchema = z.object({
  mode: z.literal('group-unlink'),
  groupId: z.number().int().positive(),
  tagIds: z.array(z.number().int().positive()).min(1),
});

export const libraryDeleteSelectionRemoveSchema = z.object({
  mode: z.literal('selection-remove'),
  tagIds: z.array(z.number().int().positive()).min(1),
  fileIds: z.array(z.number().int().positive()).min(1).optional(),
  filter: filterChainSchema.optional(),
}).refine((v) => Boolean(v.fileIds?.length) || Boolean(v.filter), {
  message: 'Either fileIds or filter is required',
  path: ['fileIds'],
});

export const libraryDeleteRequestSchema = z.union([
  libraryDeleteGroupUnlinkSchema,
  libraryDeleteSelectionRemoveSchema,
]);
export type LibraryDeleteRequest = z.infer<typeof libraryDeleteRequestSchema>;


