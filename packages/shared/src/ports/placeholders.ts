import { z } from 'zod';

import {
  expandPlaceholderRequestSchema,
  expandPlaceholderResponseSchema,
} from '../contracts/placeholders.js';

export const placeholderResolverPortSchema = z.object({
  expand: z
    .function()
    .args(expandPlaceholderRequestSchema)
    .returns(z.promise(expandPlaceholderResponseSchema)),
});
export type PlaceholderResolverPort = z.infer<typeof placeholderResolverPortSchema>;


