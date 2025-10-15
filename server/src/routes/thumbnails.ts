import { thumbnailRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ThumbnailsService } from '../services/thumbnails.js';

export function createThumbnailsRouter() {
  const router = Router();
  const service = new ThumbnailsService();

  router.get('/:id/thumbnail', asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ValidationError('Invalid id');
    }
    const parsed = thumbnailRequestSchema.safeParse({
      size: req.query.size ? Number(req.query.size) : undefined,
      format: req.query.format,
    });
    if (!parsed.success) {
      throw new ValidationError('Invalid query', { details: parsed.error.flatten() });
    }
    const info = await service.getOrCreateThumbnail(id, parsed.data);
    res.type(info.format).sendFile(info.path);
  }));

  return router;
}
