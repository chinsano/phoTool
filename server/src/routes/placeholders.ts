import { expandPlaceholderRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { placeholderResolverService } from '../services/placeholders/index.js';

export const placeholdersRouter = Router();

placeholdersRouter.post('/api/expand-placeholder', async (req, res, next) => {
  try {
    const parsedResult = expandPlaceholderRequestSchema.safeParse(req.body);
    if (!parsedResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsedResult.error.flatten() });
    }
    const parsed = parsedResult.data;
    if (parsed.fileIds.length > 1000) {
      return res.status(413).json({ error: 'Too many fileIds' });
    }
    const result = await placeholderResolverService.expand(parsed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});


