import { z } from 'zod';

export const fileTagRowSchema = z.object({
  file_id: z.number().int().nonnegative(),
  tag_id: z.number().int().nonnegative(),
});

export type FileTagRow = z.infer<typeof fileTagRowSchema>;


