import { z } from 'zod';

import { filterChainSchema } from '../filters.js';

export const sortBySchema = z.enum(['takenAt', 'mtime', 'size', 'name', 'id']);
export const sortOrderSchema = z.enum(['asc', 'desc']);
export const sortSchema = z.object({
  by: sortBySchema.default('takenAt'),
  order: sortOrderSchema.default('desc'),
});

export const pageSchema = z.object({
  limit: z.number().int().positive().max(500).default(100),
  offset: z.number().int().min(0).default(0),
});

export const filesSearchRequestSchema = z.object({
  filter: filterChainSchema,
  sort: sortSchema.default({ by: 'takenAt', order: 'desc' }).optional(),
  page: pageSchema.default({ limit: 100, offset: 0 }).optional(),
});
export type FilesSearchRequest = z.infer<typeof filesSearchRequestSchema>;

export const fileLiteSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  ext: z.string(),
  takenAt: z.string().nullable().optional(),
  width: z.number().int().nonnegative().nullable().optional(),
  height: z.number().int().nonnegative().nullable().optional(),
  duration: z.number().nonnegative().nullable().optional(),
});

export const filesSearchResponseSchema = z.object({
  items: z.array(fileLiteSchema),
  page: pageSchema.extend({ returned: z.number().int().nonnegative() }),
  total: z.number().int().nonnegative().optional(),
});
export type FilesSearchResponse = z.infer<typeof filesSearchResponseSchema>;
