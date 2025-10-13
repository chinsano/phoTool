import { z } from 'zod';

export const thumbnailFormatSchema = z.enum(['jpeg', 'webp', 'png']);
export type ThumbnailFormat = z.infer<typeof thumbnailFormatSchema>;

export const thumbnailRequestSchema = z.object({
  size: z.number().int().positive().default(512),
  format: thumbnailFormatSchema.default('jpeg'),
});
export type ThumbnailRequest = z.infer<typeof thumbnailRequestSchema>;

export const thumbnailInfoSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mtime: z.number().int().nonnegative(),
  format: thumbnailFormatSchema,
  path: z.string(),
});
export type ThumbnailInfo = z.infer<typeof thumbnailInfoSchema>;
