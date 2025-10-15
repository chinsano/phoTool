import { tagApplyBatchSchema, tagApplySingleSchema } from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { TagApplicationService } from '../services/tagApplication.js';

export function createFileTagsRouter() {
  const router = Router();
  const service = new TagApplicationService();

  router.post('/:id/tags', asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ValidationError('Invalid id');
    }
    const parsed = tagApplySingleSchema.safeParse({ ...req.body, fileId: id });
    if (!parsed.success) {
      throw new ValidationError('Invalid request', { details: parsed.error.flatten() });
    }
    await service.applyToFile(parsed.data);
    res.status(204).end();
  }));

  router.post('/tags', asyncHandler(async (req, res) => {
    const parsed = tagApplyBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request', { details: parsed.error.flatten() });
    }
    await service.applyToFiles(parsed.data);
    res.status(204).end();
  }));

  return router;
}

