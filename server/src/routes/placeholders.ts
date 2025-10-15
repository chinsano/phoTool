import { expandPlaceholderRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { placeholderResolverService } from '../services/placeholders/index.js';

export const placeholdersRouter = Router();

placeholdersRouter.post('/api/expand-placeholder', asyncHandler(async (req, res) => {
  const parsedResult = expandPlaceholderRequestSchema.safeParse(req.body);
  if (!parsedResult.success) {
    throw new ValidationError('Invalid request', { details: parsedResult.error.flatten() });
  }
  const parsed = parsedResult.data;
  if (parsed.fileIds.length > 1000) {
    throw new ValidationError('Too many fileIds');
  }
  const result = await placeholderResolverService.expand(parsed);
  res.json(result);
}));

