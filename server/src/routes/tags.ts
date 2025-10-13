import { Router } from 'express';
import {
  tagCreateSchema,
  tagListResponseSchema,
  tagUpdateSchema,
} from '@phoTool/shared';

import { TagsService } from '../services/tags.js';

export function createTagsRouter() {
  const router = Router();
  const service = new TagsService();

  router.get('/', async (_req, res) => {
    const result = await service.list();
    const validated = tagListResponseSchema.parse(result);
    res.json(validated);
  });

  router.post('/', async (req, res) => {
    const parsed = tagCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    const { id } = await service.create(parsed.data);
    res.status(201).json({ id });
  });

  router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const parsed = tagUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    await service.update(id, parsed.data);
    res.status(204).end();
  });

  return router;
}


