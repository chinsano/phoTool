import {
  tagCreateSchema,
  tagListResponseSchema,
  tagUpdateSchema,
} from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
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
      throw new ValidationError('Invalid request', { details: parsed.error.flatten() });
    }
    const input: { name: string; color?: string | null; parent_id?: number | null } = {
      name: parsed.data.name,
    };
    if ('color' in parsed.data) input.color = parsed.data.color ?? null;
    if ('parent_id' in parsed.data) input.parent_id = parsed.data.parent_id ?? null;
    const { id } = await service.create(input);
    res.status(201).json({ id });
  });

  router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ValidationError('Invalid id');
    }
    const parsed = tagUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request', { details: parsed.error.flatten() });
    }
    const input: { name?: string; color?: string | null } = {};
    if ('name' in parsed.data) input.name = parsed.data.name as string;
    if ('color' in parsed.data) input.color = parsed.data.color ?? null;
    await service.update(id, input);
    res.status(204).end();
  });

  return router;
}


