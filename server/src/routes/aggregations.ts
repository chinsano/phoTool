import { tagsAggregateRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { AggregationsService } from '../services/aggregations.js';

export function createAggregationsRouter() {
  const router = Router();
  const service = new AggregationsService();

  router.post('/aggregate', async (req, res) => {
    const parsed = tagsAggregateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    const result = await service.countTags(parsed.data);
    res.json(result);
  });

  return router;
}
