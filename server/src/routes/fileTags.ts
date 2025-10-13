import { tagApplyBatchSchema, tagApplySingleSchema } from '@phoTool/shared';
import { Router } from 'express';

import { TagApplicationService } from '../services/tagApplication.js';

export function createFileTagsRouter() {
  const router = Router();
  const service = new TagApplicationService();

  router.post('/:id/tags', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const parsed = tagApplySingleSchema.safeParse({ ...req.body, fileId: id });
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    await service.applyToFile(parsed.data);
    res.status(204).end();
  });

  router.post('/tags', async (req, res) => {
    const parsed = tagApplyBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    await service.applyToFiles(parsed.data);
    res.status(204).end();
  });

  return router;
}


