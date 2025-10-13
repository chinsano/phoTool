import { filesSearchRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { QueryService } from '../services/query.js';

export function createFilesRouter() {
  const router = Router();
  const service = new QueryService();

  router.post('/search', async (req, res) => {
    const parsed = filesSearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    const result = await service.searchFiles(parsed.data);
    res.json(result);
  });

  return router;
}
