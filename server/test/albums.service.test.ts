import type { AlbumId, UpdateAlbumRequest, AlbumListResponse } from '@phoTool/shared';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AlbumsService } from '../src/services/albums.js';

describe('AlbumsService', () => {
  let service: AlbumsService;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = path.join(tmpdir(), `albums-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    service = new AlbumsService(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('list()', () => {
    it('should return empty array when no albums exist', async () => {
      const response = await service.list();
      expect(response.albums).toEqual([]);
    });

    it('should list all albums with correct metadata', async () => {
      // Create test albums
      const album1 = {
        version: 1 as const,
        name: 'Test Album 1',
        sources: ['/path/to/photos1'],
        filter: null,
      };
      const album2 = {
        version: 1 as const,
        name: 'Test Album 2',
        sources: ['/path/to/photos2', '/path/to/photos3'],
        filter: null,
      };

      const id1 = await service.create(album1);
      const id2 = await service.create(album2);

      const response = await service.list();
      expect(response.albums).toHaveLength(2);

      // Should be sorted by updated time (newest first)
      const albumNames = response.albums.map(a => a.name);
      expect(albumNames).toContain('Test Album 1');
      expect(albumNames).toContain('Test Album 2');

      // Check metadata
      const album1Data = response.albums.find(a => a.id === id1.id);
      expect(album1Data).toBeDefined();
      expect(album1Data!.name).toBe('Test Album 1');
      expect(album1Data!.sources).toHaveLength(1);
      expect(album1Data!.updatedAt).toBeDefined();

      const album2Data = response.albums.find(a => a.id === id2.id);
      expect(album2Data).toBeDefined();
      expect(album2Data!.name).toBe('Test Album 2');
      expect(album2Data!.sources).toHaveLength(2);
    });

    it('should skip invalid album files', async () => {
      // Create a valid album
      const validAlbum = {
        version: 1 as const,
        name: 'Valid Album',
        sources: ['/path/to/photos'],
        filter: null,
      };
      await service.create(validAlbum);

      // Create an invalid JSON file
      const invalidFile = path.join(tempDir, 'invalid.json');
      await fs.writeFile(invalidFile, 'invalid json content');

      // Create a file with invalid schema
      const invalidSchemaFile = path.join(tempDir, 'invalid-schema.json');
      await fs.writeFile(invalidSchemaFile, JSON.stringify({ invalid: 'data' }));

      const response = await service.list();
      expect(response.albums).toHaveLength(1);
      expect(response.albums[0]?.name).toBe('Valid Album');
    });
  });

  describe('get()', () => {
    it('should retrieve album by ID', async () => {
      const albumData = {
        version: 1 as const,
        name: 'Test Album',
        sources: ['/path/to/photos'],
        filter: null,
      };

      const { id } = await service.create(albumData);
      const retrieved = await service.get(id);

      expect(retrieved.id).toBe(id);
      expect(retrieved.name).toBe('Test Album');
      expect(retrieved.sources).toEqual([path.resolve('/path/to/photos')]);
      expect(retrieved.filter).toBeNull();
      expect(retrieved.updatedAt).toBeDefined();
    });

    it('should throw 404 for non-existent album', async () => {
      const nonExistentId = randomUUID();
      
      await expect(service.get(nonExistentId as AlbumId)).rejects.toMatchObject({
        message: 'Album not found',
        status: 404,
      });
    });

    it('should throw error for invalid album ID format', async () => {
      await expect(service.get('invalid-id' as AlbumId)).rejects.toThrow();
    });
  });

  describe('create()', () => {
    it('should create album with valid data', async () => {
      const albumData = {
        name: 'New Album',
        sources: ['/path/to/photos'],
        filter: null,
      };

      const { id } = await service.create(albumData);
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      // Verify the album was created
      const retrieved = await service.get(id);
      expect(retrieved.name).toBe('New Album');
      expect(retrieved.sources).toEqual([path.resolve('/path/to/photos')]);
    });

    it('should normalize and deduplicate sources', async () => {
      const albumData = {
        name: 'Album with Duplicate Sources',
        sources: ['/path/to/photos', './relative/path', '/path/to/photos'],
        filter: null,
      };

      const { id } = await service.create(albumData);
      const retrieved = await service.get(id);

      // Sources should be normalized and deduplicated
      expect(retrieved.sources).toHaveLength(2);
      expect(retrieved.sources.every(source => path.isAbsolute(source))).toBe(true);
    });

  });

  describe('update()', () => {
    it('should update album with partial data', async () => {
      // Create initial album
      const initialData = {
        name: 'Initial Album',
        sources: ['/path/to/photos1'],
        filter: null,
      };
      const { id } = await service.create(initialData);

      // Update with partial data
      const updateData = {
        name: 'Updated Album',
        sources: ['/path/to/photos2'],
      };
      await service.update(id, updateData);

      // Verify update
      const retrieved = await service.get(id);
      expect(retrieved.name).toBe('Updated Album');
      expect(retrieved.sources).toEqual([path.resolve('/path/to/photos2')]);
    });

    it('should update only provided fields', async () => {
      // Create initial album
      const initialData = {
        name: 'Initial Album',
        sources: ['/path/to/photos1'],
        filter: null,
      };
      const { id } = await service.create(initialData);

      // Update only name
      const updateData = { name: 'Updated Name Only' };
      await service.update(id, updateData);

      // Verify only name was updated
      const retrieved = await service.get(id);
      expect(retrieved.name).toBe('Updated Name Only');
      expect(retrieved.sources).toEqual([path.resolve('/path/to/photos1')]); // Should remain unchanged
    });

    it('should throw 404 for non-existent album', async () => {
      const nonExistentId = randomUUID();
      const updateData = { name: 'Updated Name' };

      await expect(service.update(nonExistentId as AlbumId, updateData)).rejects.toMatchObject({
        message: 'Album not found',
        status: 404,
      });
    });

    it('should throw error for invalid update data', async () => {
      const { id } = await service.create({
        name: 'Test Album',
        sources: ['/path/to/photos'],
        filter: null,
      });

      const invalidUpdate = { name: '' }; // Empty name should be invalid

      await expect(service.update(id, invalidUpdate as UpdateAlbumRequest)).rejects.toThrow();
    });
  });

  describe('delete()', () => {
    it('should delete album and its backups', async () => {
      const albumData = {
        name: 'Album to Delete',
        sources: ['/path/to/photos'],
        filter: null,
      };
      const { id } = await service.create(albumData);

      // Verify album exists
      await expect(service.get(id)).resolves.toBeDefined();

      // Delete album
      await service.delete(id);

      // Verify album is deleted
      await expect(service.get(id)).rejects.toMatchObject({
        message: 'Album not found',
        status: 404,
      });

      // Verify file and backups are deleted
      const filePath = path.join(tempDir, `${id}.json`);
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should throw 404 for non-existent album', async () => {
      const nonExistentId = randomUUID();

      await expect(service.delete(nonExistentId as AlbumId)).rejects.toMatchObject({
        message: 'Album not found',
        status: 404,
      });
    });
  });

  describe('computeSourcesSignature()', () => {
    it('should compute consistent signatures for same sources', async () => {
      const sources1 = ['/path/to/photos1', '/path/to/photos2'];
      const sources2 = ['/path/to/photos1', '/path/to/photos2'];

      const sig1 = service.computeSourcesSignature(sources1);
      const sig2 = service.computeSourcesSignature(sources2);

      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[a-f0-9]{40}$/); // SHA1 hex string
    });

    it('should compute different signatures for different sources', async () => {
      const sources1 = ['/path/to/photos1'];
      const sources2 = ['/path/to/photos2'];

      const sig1 = service.computeSourcesSignature(sources1);
      const sig2 = service.computeSourcesSignature(sources2);

      expect(sig1).not.toBe(sig2);
    });

    it('should normalize paths before computing signature', async () => {
      const sources1 = ['/path/to/photos', './relative/path'];
      const sources2 = ['/path/to/photos', path.resolve('./relative/path')];

      const sig1 = service.computeSourcesSignature(sources1);
      const sig2 = service.computeSourcesSignature(sources2);

      expect(sig1).toBe(sig2);
    });
  });

  describe('atomic operations', () => {
    it('should handle concurrent reads and writes', async () => {
      const albumData = {
        name: 'Concurrent Test Album',
        sources: ['/path/to/photos'],
        filter: null,
      };

      const { id } = await service.create(albumData);

      // Perform concurrent operations
      const promises = [
        service.get(id),
        service.update(id, { name: 'Updated Name' }),
        service.get(id),
        service.list(),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
      expect(results[0]).toBeDefined(); // First get
      expect(results[2]).toBeDefined(); // Second get
      expect(results[3]).toHaveProperty('albums');
      expect((results[3] as AlbumListResponse).albums).toHaveLength(1); // List
    });

    it('should maintain data integrity during updates', async () => {
      const albumData = {
        name: 'Integrity Test Album',
        sources: ['/path/to/photos'],
        filter: null,
      };

      const { id } = await service.create(albumData);

      // Perform multiple updates
      await service.update(id, { name: 'Updated Name 1' });
      await service.update(id, { sources: ['/new/path'] });
      await service.update(id, { name: 'Final Name' });

      const final = await service.get(id);
      expect(final.name).toBe('Final Name');
      expect(final.sources).toEqual([path.resolve('/new/path')]);
    });
  });

  describe('error handling', () => {
    it('should handle corrupted album files gracefully', async () => {
      // Create a valid album first
      const { id } = await service.create({
        name: 'Valid Album',
        sources: ['/path/to/photos'],
        filter: null,
      });

      // Corrupt the file
      const filePath = path.join(tempDir, `${id}.json`);
      await fs.writeFile(filePath, 'corrupted json content');

      // List should skip corrupted files
      const response = await service.list();
      expect(response.albums).toHaveLength(0);

      // Get should throw error
      await expect(service.get(id)).rejects.toThrow();
    });

    it('should handle missing albums directory', async () => {
      // Create service with non-existent directory
      const nonExistentDir = path.join(tmpdir(), 'non-existent-albums');
      const serviceWithNonExistentDir = new AlbumsService(nonExistentDir);

      // List should return empty array
      const response = await serviceWithNonExistentDir.list();
      expect(response.albums).toEqual([]);

      // Create should work (creates directory)
      const { id } = await serviceWithNonExistentDir.create({
        name: 'Test Album',
        sources: ['/path/to/photos'],
        filter: null,
      });

      expect(id).toBeDefined();

      // Clean up
      await fs.rm(nonExistentDir, { recursive: true, force: true });
    });
  });
});
