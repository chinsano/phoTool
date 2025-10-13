import { Router } from 'express';
import {
  tagGroupCreateSchema,
  tagGroupItemsChangeSchema,
  tagGroupListResponseSchema,
} from '@phoTool/shared';

import { TagGroupsService } from '../services/tagGroups.js';

export function createTagGroupsRouter() {
  const router = Router();
  const service = new TagGroupsService();

  router.get('/', async (_req, res) => {
    const result = await service.list();
    const validated = tagGroupListResponseSchema.parse(result);
    res.json(validated);
  });

  router.post('/', async (req, res) => {
    const parsed = tagGroupCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    const { id } = await service.create(parsed.data);
    res.status(201).json({ id });
  });

  router.post('/:id/items', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const parsed = tagGroupItemsChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    await service.changeItems(id, parsed.data);
    res.status(204).end();
  });

  return router;
}


