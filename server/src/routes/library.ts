import { libraryDeleteRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { LibraryService } from '../services/library.js';

export function createLibraryRouter() {
  const router = Router();
  const service = new LibraryService();

  router.post('/delete', asyncHandler(async (req, res) => {
    const parsed = libraryDeleteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request', { details: parsed.error.flatten() });
    }
    const body = parsed.data;
    if (body.mode === 'group-unlink') {
      await service.groupUnlink(body.groupId, body.tagIds);
      res.status(204).end();
      return;
    }
    await service.selectionRemove(body.tagIds, body.fileIds, body.filter);
    res.status(204).end();
  }));

  return router;
}

