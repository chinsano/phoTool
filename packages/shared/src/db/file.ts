import { z } from 'zod';

export const fileRowSchema = z.object({
  id: z.number().int().nonnegative(),
  path: z.string().min(1),
  dir: z.string().min(1),
  name: z.string().min(1),
  ext: z.string().min(0),
  size: z.number().int().nonnegative(),
  mtime: z.number().int().nonnegative(),
  ctime: z.number().int().nonnegative(),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  duration: z.number().nonnegative().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  taken_at: z.string().datetime().nullable(),
  xmp_path: z.string().nullable(),
  xmp_mtime: z.number().int().nonnegative().nullable(),
  last_indexed_at: z.string().datetime().nullable(),
});

export type FileRow = z.infer<typeof fileRowSchema>;


