import { albumIdSchema, createAlbumRequestSchema, updateAlbumRequestSchema } from '@phoTool/shared';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';

import { logger } from '../logger.js';
import { AlbumsService } from '../services/albums.js';

// Lazy instantiation to allow environment variable changes in tests
let albumsService: AlbumsService | null = null;

function getAlbumsService(): AlbumsService {
  if (!albumsService) {
    albumsService = new AlbumsService();
  }
  return albumsService;
}

// For testing - reset the service instance
export function resetAlbumsService(): void {
  albumsService = null;
}

/**
 * GET /api/albums
 * List all albums
 */
export const listAlbums = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await getAlbumsService().list();
    res.json(response);
    logger.debug({ count: response.albums.length }, 'Listed albums');
  } catch (error) {
    logger.error({ error }, 'Failed to list albums');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to list albums',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/albums/:id
 * Get a single album by ID
 */
export const getAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Validate album ID format
    const albumId = albumIdSchema.parse(id);
    
    const response = await getAlbumsService().get(albumId);
    res.json(response);
    logger.debug({ id: albumId }, 'Retrieved album');
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error: error.issues, id: req.params.id }, 'Invalid album ID format');
      res.status(400).json({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid album ID format',
        details: error.issues,
      });
      return;
    }

    if ((error as NodeJS.ErrnoException & { status?: number }).status === 404) {
      logger.warn({ id: req.params.id }, 'Album not found');
      res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: `Album with ID ${req.params.id} not found`,
      });
      return;
    }

    logger.error({ error, id: req.params.id }, 'Failed to get album');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get album',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/albums
 * Create a new album
 */
export const createAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const requestData = createAlbumRequestSchema.parse(req.body);
    
    const response = await getAlbumsService().create(requestData);
    res.status(201).json(response);
    logger.info({ id: response.id, name: response.name }, 'Created album');
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error: error.issues, body: req.body }, 'Invalid album creation request');
      res.status(400).json({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid album creation request',
        details: error.issues,
      });
      return;
    }

    logger.error({ error, body: req.body }, 'Failed to create album');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to create album',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * PUT /api/albums/:id
 * Update an existing album
 */
export const updateAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Validate album ID format
    const albumId = albumIdSchema.parse(id);
    
    // Validate request body
    const requestData = updateAlbumRequestSchema.parse(req.body);
    
    const response = await getAlbumsService().update(albumId, requestData);
    res.json(response);
    logger.info({ id: albumId, updates: Object.keys(requestData) }, 'Updated album');
  } catch (error) {
    if (error instanceof ZodError) {
      const isIdError = error.issues.some(e => e.path.includes('id'));
      logger.warn({ 
        error: error.issues, 
        id: req.params.id, 
        body: req.body 
      }, isIdError ? 'Invalid album ID format' : 'Invalid album update request');
      
      res.status(400).json({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: isIdError ? 'Invalid album ID format' : 'Invalid album update request',
        details: error.issues,
      });
      return;
    }

    if ((error as NodeJS.ErrnoException & { status?: number }).status === 404) {
      logger.warn({ id: req.params.id }, 'Album not found for update');
      res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: `Album with ID ${req.params.id} not found`,
      });
      return;
    }

    logger.error({ error, id: req.params.id, body: req.body }, 'Failed to update album');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to update album',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * DELETE /api/albums/:id
 * Delete an album by ID
 */
export const deleteAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Validate album ID format
    const albumId = albumIdSchema.parse(id);
    
    await getAlbumsService().delete(albumId);
    res.status(204).send();
    logger.info({ id: albumId }, 'Deleted album');
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn({ error: error.issues, id: req.params.id }, 'Invalid album ID format');
      res.status(400).json({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid album ID format',
        details: error.issues,
      });
      return;
    }

    if ((error as NodeJS.ErrnoException & { status?: number }).status === 404) {
      logger.warn({ id: req.params.id }, 'Album not found for deletion');
      res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: `Album with ID ${req.params.id} not found`,
      });
      return;
    }

    logger.error({ error, id: req.params.id }, 'Failed to delete album');
    res.status(500).json({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete album',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Create albums router
 */
export function createAlbumsRouter() {
  const router = Router();

  router.get('/', listAlbums);
  router.get('/:id', getAlbum);
  router.post('/', createAlbum);
  router.put('/:id', updateAlbum);
  router.delete('/:id', deleteAlbum);

  return router;
}
