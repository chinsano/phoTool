import { uiStateSchema } from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { UiStateService } from '../services/uiState.js';

// Lazy instantiation to allow environment variable changes in tests
let uiStateService: UiStateService | null = null;

function getUiStateService(): UiStateService {
  if (!uiStateService) {
    uiStateService = new UiStateService();
  }
  return uiStateService;
}

// For testing - reset the service instance
export function resetUiStateService(): void {
  uiStateService = null;
}

/**
 * Create UI state router
 */
export function createUiStateRouter() {
  const router = Router();
  const service = getUiStateService();

  // GET /api/state - Get current UI state
  router.get('/', asyncHandler(async (_req, res) => {
    const state = await service.get();
    res.json(state);
  }));

  // PUT /api/state - Update UI state
  router.put('/', asyncHandler(async (req, res) => {
    const parsed = uiStateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid UI state update request', { details: parsed.error.flatten() });
    }
    
    await service.update(parsed.data);
    res.status(204).send();
  }));

  // POST /api/state/reset - Reset UI state to default
  router.post('/reset', asyncHandler(async (_req, res) => {
    await service.reset();
    res.status(204).send();
  }));

  // GET /api/state/stats - Get UI state file statistics
  router.get('/stats', asyncHandler(async (_req, res) => {
    const stats = await service.getStats();
    res.json(stats);
  }));

  return router;
}
