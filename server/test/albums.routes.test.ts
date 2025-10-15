import type { CreateAlbumRequest, UpdateAlbumRequest } from '@phoTool/shared';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createApp } from '../src/app.js';
import { resetAlbumsService } from '../src/routes/albums.js';

describe('Albums Routes', () => {
  let app: ReturnType<typeof createApp>;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for albums
    tempDir = path.join(tmpdir(), `albums-routes-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Set environment variable for albums directory
    process.env.ALBUMS_DIR = tempDir;
    
    // Reset the service to pick up the new environment variable
    resetAlbumsService();
    
    app = createApp();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.ALBUMS_DIR;
  });

  describe('GET /api/albums', () => {
    it('should return empty list when no albums exist', async () => {
      const response = await request(app)
        .get('/api/albums')
        .expect(200);

      expect(response.body).toEqual({ albums: [] });
    });

    it('should list existing albums', async () => {
      // Create test albums using the API
      const album1 = {
        name: 'Test Album 1',
        sources: ['/path/to/photos1'],
        filter: null,
      };
      const album2 = {
        name: 'Test Album 2',
        sources: ['/path/to/photos2'],
        filter: null,
      };

      await request(app)
        .post('/api/albums')
        .send(album1)
        .expect(201);

      await request(app)
        .post('/api/albums')
        .send(album2)
        .expect(201);

      const response = await request(app)
        .get('/api/albums')
        .expect(200);

      expect(response.body.albums).toHaveLength(2);
            expect(response.body.albums.map((a: { name: string }) => a.name)).toContain('Test Album 1');
            expect(response.body.albums.map((a: { name: string }) => a.name)).toContain('Test Album 2');
    });
  });

  describe('GET /api/albums/:id', () => {
    it('should return album by ID', async () => {
      const albumData = {
        name: 'Test Album',
        sources: ['/path/to/photos'],
        filter: null,
      };

      const createResponse = await request(app)
        .post('/api/albums')
        .send(albumData)
        .expect(201);

      const id = createResponse.body.id;

      const response = await request(app)
        .get(`/api/albums/${id}`)
        .expect(200);

      expect(response.body.id).toBe(id);
      expect(response.body.name).toBe('Test Album');
      expect(response.body.sources).toEqual([path.resolve('/path/to/photos')]);
      expect(response.body.filter).toBeNull();
    });

    it('should return 404 for non-existent album', async () => {
      const nonExistentId = randomUUID();
      
      const response = await request(app)
        .get(`/api/albums/${nonExistentId}`)
        .expect(404);

      expect(response.body.error.code).toBe('not_found');
      expect(response.body.error.message).toContain(nonExistentId);
    });

  });

  describe('POST /api/albums', () => {
    it('should create album with valid data', async () => {
      const albumData: CreateAlbumRequest = {
        name: 'New Album',
        sources: ['/path/to/photos'],
        filter: null,
      };

      const response = await request(app)
        .post('/api/albums')
        .send(albumData)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(typeof response.body.id).toBe('string');
      expect(response.body.name).toBe('New Album');
      expect(response.body.sources).toEqual([path.resolve('/path/to/photos')]);
      expect(response.body.filter).toBeNull();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });


    it('should normalize and deduplicate sources', async () => {
      const albumData: CreateAlbumRequest = {
        name: 'Album with Duplicate Sources',
        sources: ['/path/to/photos', '/path/to/photos/', '/path/to/photos'],
        filter: null,
      };

      const response = await request(app)
        .post('/api/albums')
        .send(albumData)
        .expect(201);

      // All paths should normalize to the same absolute path
      expect(response.body.sources).toHaveLength(1);
      expect(response.body.sources[0]).toBe(path.resolve('/path/to/photos'));
    });
  });

  describe('PUT /api/albums/:id', () => {
    it('should update album with valid data', async () => {
      // Create initial album
      const initialData = {
        version: 1,
        name: 'Initial Album',
        sources: ['/path/to/photos1'],
        filter: null,
      };

      const id = randomUUID();
      await fs.writeFile(
        path.join(tempDir, `${id}.json`),
        JSON.stringify(initialData, null, 2)
      );

      // Update album
      const updateData: UpdateAlbumRequest = {
        name: 'Updated Album',
        sources: ['/path/to/photos2'],
      };

      const response = await request(app)
        .put(`/api/albums/${id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.id).toBe(id);
      expect(response.body.name).toBe('Updated Album');
      expect(response.body.sources).toEqual([path.resolve('/path/to/photos2')]);
    });

    it('should update only provided fields', async () => {
      // Create initial album using the API
      const initialData: CreateAlbumRequest = {
        name: 'Initial Album',
        sources: ['/path/to/photos1'],
        filter: null,
      };

      const createResponse = await request(app)
        .post('/api/albums')
        .send(initialData)
        .expect(201);
      const id = createResponse.body.id;

      // Update only name
      const updateData: UpdateAlbumRequest = { name: 'Updated Name Only' };

      const response = await request(app)
        .put(`/api/albums/${id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Name Only');
      expect(response.body.sources).toEqual([path.resolve('/path/to/photos1')]); // Should remain unchanged
    });

    it('should return 404 for non-existent album', async () => {
      const nonExistentId = randomUUID();
      const updateData: UpdateAlbumRequest = { name: 'Updated Name' };

      const response = await request(app)
        .put(`/api/albums/${nonExistentId}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error.code).toBe('not_found');
      expect(response.body.error.message).toContain(nonExistentId);
    });

  });

  describe('DELETE /api/albums/:id', () => {
    it('should delete existing album', async () => {
      const albumData = {
        version: 1,
        name: 'Album to Delete',
        sources: ['/path/to/delete'],
        filter: null,
      };

      const id = randomUUID();
      await fs.writeFile(
        path.join(tempDir, `${id}.json`),
        JSON.stringify(albumData, null, 2)
      );

      await request(app)
        .delete(`/api/albums/${id}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/albums/${id}`)
        .expect(404);
    });

    it('should return 404 for non-existent album', async () => {
      const nonExistentId = randomUUID();

      const response = await request(app)
        .delete(`/api/albums/${nonExistentId}`)
        .expect(404);

      expect(response.body.error.code).toBe('not_found');
      expect(response.body.error.message).toContain(nonExistentId);
    });

  });

  describe('Error handling', () => {
    it('should return 400 for invalid album ID with special characters in GET', async () => {
      const response = await request(app)
        .get('/api/albums/invalid@id!')
        .expect(400);

      expect(response.body.error.code).toBe('validation_error');
      expect(response.body.error.message).toContain('Invalid album ID format');
    });

    it('should return 400 for invalid album ID with special characters in PUT', async () => {
      const response = await request(app)
        .put('/api/albums/invalid@id!')
        .send({ name: 'Test' })
        .expect(400);

      expect(response.body.error.code).toBe('validation_error');
      expect(response.body.error.message).toContain('Invalid album ID format');
    });

    it('should return 400 for invalid album ID with special characters in DELETE', async () => {
      const response = await request(app)
        .delete('/api/albums/invalid@id!')
        .expect(400);

      expect(response.body.error.code).toBe('validation_error');
      expect(response.body.error.message).toContain('Invalid album ID format');
    });

    it('should return 400 for invalid creation request', async () => {
      const response = await request(app)
        .post('/api/albums')
        .send({ name: 123 }) // name should be string
        .expect(400);

      expect(response.body.error.code).toBe('validation_error');
      expect(response.body.error.message).toContain('Invalid album creation request');
    });

    it('should return 400 for invalid update request', async () => {
      const id = randomUUID();
      const response = await request(app)
        .put(`/api/albums/${id}`)
        .send({ name: 123 }) // name should be string
        .expect(400);

      expect(response.body.error.code).toBe('validation_error');
      expect(response.body.error.message).toContain('Invalid album update request');
    });

    it('should handle corrupted album files gracefully', async () => {
      const id = randomUUID();
      // Create a file with invalid JSON
      await fs.writeFile(
        path.join(tempDir, `${id}.json`),
        '{ invalid json'
      );

      // List should skip corrupted files
      const listResponse = await request(app)
        .get('/api/albums')
        .expect(200);

      expect(listResponse.body.albums).toHaveLength(0);

      // Get should return 404 for corrupted file (no valid backups)
      await request(app)
        .get(`/api/albums/${id}`)
        .expect(404);
    });

    it('should handle missing albums directory', async () => {
      // Remove the directory
      await fs.rm(tempDir, { recursive: true, force: true });

      // List should return empty array
      const response = await request(app)
        .get('/api/albums')
        .expect(200);

      expect(response.body.albums).toEqual([]);
    });
  });
});
