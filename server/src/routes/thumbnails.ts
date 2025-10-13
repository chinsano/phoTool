import { thumbnailRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { ThumbnailsService } from '../services/thumbnails.js';

export function createThumbnailsRouter() {
  const router = Router();
  const service = new ThumbnailsService();

  router.get('/:id/thumbnail', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const parsed = thumbnailRequestSchema.safeParse({
      size: req.query.size ? Number(req.query.size) : undefined,
      format: req.query.format,
    });
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
      return;
    }
    try {
      const info = await service.getOrCreateThumbnail(id, parsed.data);
      res.type(info.format).sendFile(info.path);
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      const status = err?.status ?? 500;
      res.status(status).json({ error: err?.message ?? 'Error' });
    }
  });

  return router;
}
