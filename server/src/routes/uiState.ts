import { uiStateSchema } from '@phoTool/shared';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';

import { logger } from '../logger.js';
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
 * GET /api/state
 * Get current UI state
 */
export const getUiState = async (req: Request, res: Response): Promise<void> => {
  try {
    const state = await getUiStateService().get();
    res.json(state);
    logger.debug('Retrieved UI state');
  } catch (error) {
    logger.error({ error }, 'Failed to get UI state');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get UI state',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * PUT /api/state
 * Update UI state
 */
export const updateUiState = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body against UI state schema
    const stateData = uiStateSchema.parse(req.body);
    
    await getUiStateService().update(stateData);
    res.status(204).send();
    logger.info({ updatedFields: Object.keys(stateData) }, 'Updated UI state');
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error: error.issues, body: req.body }, 'Invalid UI state update request');
      res.status(400).json({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid UI state update request',
        details: error.issues,
      });
      return;
    }

    if ((error as NodeJS.ErrnoException & { status?: number }).status === 400) {
      logger.warn({ error, body: req.body }, 'Invalid UI state update data');
      res.status(400).json({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid UI state update data',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    logger.error({ error, body: req.body }, 'Failed to update UI state');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to update UI state',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/state/reset
 * Reset UI state to default
 */
export const resetUiState = async (req: Request, res: Response): Promise<void> => {
  try {
    await getUiStateService().reset();
    res.status(204).send();
    logger.info('Reset UI state to default');
  } catch (error) {
    logger.error({ error }, 'Failed to reset UI state');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to reset UI state',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/state/stats
 * Get UI state file statistics
 */
export const getUiStateStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getUiStateService().getStats();
    res.json(stats);
    logger.debug('Retrieved UI state stats');
  } catch (error) {
    logger.error({ error }, 'Failed to get UI state stats');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get UI state stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Create UI state router
 */
export function createUiStateRouter() {
  const router = Router();

  router.get('/', getUiState);
  router.put('/', updateUiState);
  router.post('/reset', resetUiState);
  router.get('/stats', getUiStateStats);

  return router;
}
