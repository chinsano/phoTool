import { z } from 'zod';

export const placeholderTokenSchema = z.enum([
  'year',
  'month',
  'day',
  'weekday',
  'country',
  'state',
  'city',
]);
export type PlaceholderToken = z.infer<typeof placeholderTokenSchema>;

export const expandPlaceholderRequestSchema = z.object({
  fileIds: z.array(z.number().int().positive()).min(1),
  tokens: z.array(placeholderTokenSchema).min(1),
});
export type ExpandPlaceholderRequest = z.infer<typeof expandPlaceholderRequestSchema>;

export const expandPlaceholderResponseSchema = z.object({
  expansions: z.record(
    z.string(),
    z.array(z.string())
  ),
});
export type ExpandPlaceholderResponse = z.infer<typeof expandPlaceholderResponseSchema>;


