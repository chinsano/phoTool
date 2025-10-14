import type {
  AlbumsPort,
  AlbumId,
  CreateAlbumRequest,
  UpdateAlbumRequest,
  AlbumDetailResponse,
  AlbumListResponse,
  AlbumListItem,
} from '@phoTool/shared';
import { smartAlbumSchema, albumIdSchema } from '@phoTool/shared';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { logger } from '../logger.js';
import { AtomicJsonStore } from '../utils/atomicJsonStore.js';
import { computeSignature, normalizePaths } from './scanner/fs.js';

export class AlbumsService implements AlbumsPort {
  private readonly albumsDir: string;

  constructor(albumsDir: string = path.resolve(process.cwd(), 'data', 'albums')) {
    this.albumsDir = albumsDir;
  }

  async list(): Promise<AlbumListResponse> {
    try {
      const albums: AlbumListItem[] = [];
      
      // Read all JSON files in the albums directory
      const files = await this.getAlbumFiles();
      
      for (const file of files) {
        try {
          const store = new AtomicJsonStore(file);
          const albumData = await store.read();
          
          if (albumData) {
            // Validate the album data
            const validatedAlbum = smartAlbumSchema.parse(albumData);
            const stats = await store.getStats();
            const albumId = this.getAlbumIdFromFilename(file);
            const now = new Date().toISOString();
            
            albums.push({
              id: albumId,
              name: validatedAlbum.name,
              sources: validatedAlbum.sources,
              createdAt: now, // We don't have creation time, use current time
              updatedAt: stats?.mtime.toISOString() ?? now,
            });
          }
        } catch (error) {
          logger.warn({ error, file }, 'Failed to read album file, skipping');
          // Continue with other files
        }
      }

      // Sort by updated time (newest first)
      albums.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      logger.debug({ count: albums.length }, 'Listed albums');
      return { albums };
    } catch (error) {
      logger.error({ error }, 'Failed to list albums');
      throw error;
    }
  }

  async get(id: AlbumId): Promise<AlbumDetailResponse> {
    try {
      // Validate album ID format
      albumIdSchema.parse(id);
      
      const filePath = this.getAlbumFilePath(id);
      const store = new AtomicJsonStore(filePath);
      
      const albumData = await store.read();
      if (!albumData) {
        throw Object.assign(new Error('Album not found'), { status: 404 });
      }

      // Validate the album data
      const validatedAlbum = smartAlbumSchema.parse(albumData);
      const stats = await store.getStats();

      const now = new Date().toISOString();
      const response: AlbumDetailResponse = {
        id,
        ...validatedAlbum,
        createdAt: now, // We don't have creation time, use current time
        updatedAt: stats?.mtime.toISOString() ?? now,
      };

      logger.debug({ id }, 'Retrieved album');
      return response;
    } catch (error) {
      if ((error as NodeJS.ErrnoException & { status?: number }).status === 404) {
        throw error;
      }
      logger.error({ error, id }, 'Failed to get album');
      throw error;
    }
  }

  async create(req: CreateAlbumRequest): Promise<AlbumDetailResponse> {
    try {
      // Validate request
      const validatedRequest = smartAlbumSchema.omit({ version: true }).parse(req);
      
      // Generate unique ID
      const id = randomUUID() as AlbumId;
      
      // Normalize sources (normalizePaths already handles deduplication)
      const normalizedSources = normalizePaths(validatedRequest.sources);

      // Create album data
      const albumData = {
        version: 1 as const,
        name: validatedRequest.name,
        sources: normalizedSources,
        filter: validatedRequest.filter,
      };

      // Write to file
      const filePath = this.getAlbumFilePath(id);
      const store = new AtomicJsonStore(filePath);
      await store.write(albumData);

      const now = new Date().toISOString();
      const response: AlbumDetailResponse = {
        id,
        ...albumData,
        createdAt: now,
        updatedAt: now,
      };

      logger.info({ id, name: validatedRequest.name, sourceCount: normalizedSources.length }, 'Created album');
      return response;
    } catch (error) {
      if ((error as NodeJS.ErrnoException & { status?: number }).status === 400) {
        throw error;
      }
      logger.error({ error, request: req }, 'Failed to create album');
      throw error;
    }
  }

  async update(id: AlbumId, req: UpdateAlbumRequest): Promise<AlbumDetailResponse> {
    try {
      // Validate album ID format
      albumIdSchema.parse(id);
      
      // Validate request
      const validatedRequest = smartAlbumSchema.partial().omit({ version: true }).parse(req);
      
      const filePath = this.getAlbumFilePath(id);
      const store = new AtomicJsonStore(filePath);
      
      // Check if album exists
      const existingData = await store.read();
      if (!existingData) {
        throw Object.assign(new Error('Album not found'), { status: 404 });
      }

      // Validate existing data
      const existingAlbum = smartAlbumSchema.parse(existingData);
      
      // Merge with existing data
      const updatedAlbum = {
        ...existingAlbum,
        ...validatedRequest,
        // Normalize sources if provided
        sources: validatedRequest.sources ? normalizePaths(validatedRequest.sources) : existingAlbum.sources,
      };

      // Validate merged data
      const finalAlbum = smartAlbumSchema.parse(updatedAlbum);
      
      // Write updated data
      await store.write(finalAlbum);

      const now = new Date().toISOString();
      const response: AlbumDetailResponse = {
        id,
        ...finalAlbum,
        createdAt: now, // We don't have creation time, use current time
        updatedAt: now,
      };

      logger.info({ id, updates: Object.keys(validatedRequest) }, 'Updated album');
      return response;
    } catch (error) {
      if ((error as NodeJS.ErrnoException & { status?: number }).status === 404 || (error as NodeJS.ErrnoException & { status?: number }).status === 400) {
        throw error;
      }
      logger.error({ error, id, request: req }, 'Failed to update album');
      throw error;
    }
  }

  async delete(id: AlbumId): Promise<void> {
    try {
      // Validate album ID format
      albumIdSchema.parse(id);
      
      const filePath = this.getAlbumFilePath(id);
      const store = new AtomicJsonStore(filePath);
      
      // Check if album exists
      const exists = await store.exists();
      if (!exists) {
        throw Object.assign(new Error('Album not found'), { status: 404 });
      }

      // Delete the file and backups
      await store.delete();

      logger.info({ id }, 'Deleted album');
    } catch (error) {
      if ((error as NodeJS.ErrnoException & { status?: number }).status === 404) {
        throw error;
      }
      logger.error({ error, id }, 'Failed to delete album');
      throw error;
    }
  }

  /**
   * Compute signature for album sources (reused from scanner).
   */
  computeSourcesSignature(sources: string[]): string {
    return computeSignature(sources);
  }

  /**
   * Get the file path for an album ID.
   */
  private getAlbumFilePath(id: AlbumId): string {
    return path.join(this.albumsDir, `${id}.json`);
  }

  /**
   * Get album ID from filename.
   */
  private getAlbumIdFromFilename(filePath: string): AlbumId {
    const filename = path.basename(filePath, '.json');
    return filename as AlbumId;
  }

  /**
   * Get all album files in the directory.
   */
  private async getAlbumFiles(): Promise<string[]> {
    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(this.albumsDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.albumsDir, file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist, return empty array
        return [];
      }
      throw error;
    }
  }
}
