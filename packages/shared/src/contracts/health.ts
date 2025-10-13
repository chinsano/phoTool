import { z } from 'zod';

export const HealthResponse = z.object({
  ok: z.literal(true),
  name: z.string(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponse>;


