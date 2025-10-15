import { albumIdSchema, createAlbumRequestSchema, updateAlbumRequestSchema } from '@phoTool/shared';
import { Router } from 'express';

import { ValidationError } from '../errors.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
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
 * Create albums router
 */
export function createAlbumsRouter() {
  const router = Router();
  const service = getAlbumsService();

  // GET /api/albums - List all albums
  router.get('/', asyncHandler(async (_req, res) => {
    const response = await service.list();
    res.json(response);
  }));

  // GET /api/albums/:id - Get a single album by ID
  router.get('/:id', asyncHandler(async (req, res) => {
    const parsed = albumIdSchema.safeParse(req.params.id);
    if (!parsed.success) {
      throw new ValidationError('Invalid album ID format', { details: parsed.error.flatten() });
    }
    
    const response = await service.get(parsed.data);
    res.json(response);
  }));

  // POST /api/albums - Create a new album
  router.post('/', asyncHandler(async (req, res) => {
    const parsed = createAlbumRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid album creation request', { details: parsed.error.flatten() });
    }
    
    const response = await service.create(parsed.data);
    res.status(201).json(response);
  }));

  // PUT /api/albums/:id - Update an existing album
  router.put('/:id', asyncHandler(async (req, res) => {
    const parsedId = albumIdSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      throw new ValidationError('Invalid album ID format', { details: parsedId.error.flatten() });
    }
    
    const parsedBody = updateAlbumRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError('Invalid album update request', { details: parsedBody.error.flatten() });
    }
    
    const response = await service.update(parsedId.data, parsedBody.data);
    res.json(response);
  }));

  // DELETE /api/albums/:id - Delete an album by ID
  router.delete('/:id', asyncHandler(async (req, res) => {
    const parsed = albumIdSchema.safeParse(req.params.id);
    if (!parsed.success) {
      throw new ValidationError('Invalid album ID format', { details: parsed.error.flatten() });
    }
    
    await service.delete(parsed.data);
    res.status(204).send();
  }));

  return router;
}
