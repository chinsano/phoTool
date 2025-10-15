import {
  tagGroupCreateSchema,
  tagGroupItemsChangeSchema,
  tagGroupListResponseSchema,
} from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { TagGroupsService } from '../services/tagGroups.js';

export function createTagGroupsRouter() {
  const router = Router();
  const service = new TagGroupsService();

  router.get('/', asyncHandler(async (_req, res) => {
    const result = await service.list();
    const validated = tagGroupListResponseSchema.parse(result);
    res.json(validated);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const parsed = tagGroupCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request', { details: parsed.error.flatten() });
    }
    const { id } = await service.create(parsed.data);
    res.status(201).json({ id });
  }));

  router.post('/:id/items', asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ValidationError('Invalid id');
    }
    const parsed = tagGroupItemsChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request', { details: parsed.error.flatten() });
    }
    const change: { add?: number[]; remove?: number[] } = {};
    if (parsed.data.add) change.add = parsed.data.add;
    if (parsed.data.remove) change.remove = parsed.data.remove;
    await service.changeItems(id, change);
    res.status(204).end();
  }));

  return router;
}

