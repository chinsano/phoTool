import { filesSearchRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { QueryService } from '../services/query.js';

export function createFilesRouter() {
  const router = Router();
  const service = new QueryService();

  router.post('/search', asyncHandler(async (req, res) => {
    const parsed = filesSearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request', { details: parsed.error.flatten() });
    }
    const result = await service.searchFiles(parsed.data);
    res.json(result);
  }));

  return router;
}
