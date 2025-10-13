import { libraryDeleteRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { LibraryService } from '../services/library.js';

export function createLibraryRouter() {
  const router = Router();
  const service = new LibraryService();

  router.post('/delete', async (req, res) => {
    const parsed = libraryDeleteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    if (body.mode === 'group-unlink') {
      await service.groupUnlink(body.groupId, body.tagIds);
      res.status(204).end();
      return;
    }
    await service.selectionRemove(body.tagIds, body.fileIds, body.filter);
    res.status(204).end();
  });

  return router;
}


