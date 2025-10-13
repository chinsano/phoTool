import { z } from 'zod';

import { filterChainSchema } from '../filters.js';

export const aggregationScopeSchema = z.enum(['selection', 'source']);

const selectionAggregationSchema = z.object({
  scope: z.literal('selection'),
  filter: filterChainSchema,
});

const sourceAggregationSchema = z
  .object({
    scope: z.literal('source'),
    roots: z.array(z.string().min(1)).min(1).optional(),
    sourceSignature: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.roots?.length) || Boolean(v.sourceSignature), {
    message: 'Either roots or sourceSignature is required',
    path: ['roots'],
  });

export const tagsAggregateRequestSchema = z.union([
  selectionAggregationSchema,
  sourceAggregationSchema,
]);
export type TagsAggregateRequest = z.infer<typeof tagsAggregateRequestSchema>;

export const tagCountSchema = z.object({
  tagId: z.number().int().positive(),
  count: z.number().int().nonnegative(),
});

export const tagsAggregateResponseSchema = z.object({
  counts: z.array(tagCountSchema),
});
export type TagsAggregateResponse = z.infer<typeof tagsAggregateResponseSchema>;
