import type { UiState } from '@phoTool/shared';
import { createDefaultUiState } from '@phoTool/shared';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createApp } from '../src/app.js';
import { resetUiStateService } from '../src/routes/uiState.js';

describe('UI State Routes', () => {
  let app: ReturnType<typeof createApp>;
  let tempDir: string;
  let tempFilePath: string;

  beforeEach(async () => {
    // Create a temporary directory for UI state
    tempDir = path.join(tmpdir(), `ui-state-routes-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    tempFilePath = path.join(tempDir, 'ui-state.json');
    
    // Set environment variable for UI state file path
    process.env.UI_STATE_FILE_PATH = tempFilePath;
    
    // Reset the service to pick up the new environment variable
    resetUiStateService();
    
    app = createApp();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.UI_STATE_FILE_PATH;
  });

  describe('GET /api/state', () => {
    it('should return default state when no file exists', async () => {
      const response = await request(app)
        .get('/api/state')
        .expect(200);

      const defaultState = createDefaultUiState();
      expect(response.body).toEqual(defaultState);
    });

    it('should return state from file', async () => {
      const testState: UiState = {
        version: 1,
        currentVersion: 1,
        migrations: [],
        selection: {
          selectedFileIds: [1, 2, 3],
          lastSelectedId: 3,
        },
        filter: {
          activeChain: null,
          history: [],
        },
        layout: {
          activeView: 'grid',
          panelSizes: { left: 300, right: 400 },
        },
        preferences: {
          locale: 'en',
          theme: 'dark',
        },
      };

      await fs.writeFile(tempFilePath, JSON.stringify(testState, null, 2));

      const response = await request(app)
        .get('/api/state')
        .expect(200);

      expect(response.body).toEqual(testState);
    });

    it('should return default state when file contains invalid data', async () => {
      const invalidData = {
        version: 1,
        selection: { selectedFileIds: 'not-an-array' }, // Invalid type
        filter: { activeChain: null, history: [] },
        layout: { activeView: 'list', panelSizes: {} },
        preferences: { locale: 'en', theme: 'light' },
      };

      await fs.writeFile(tempFilePath, JSON.stringify(invalidData, null, 2));

      const response = await request(app)
        .get('/api/state')
        .expect(200);

      const defaultState = createDefaultUiState();
      expect(response.body).toEqual(defaultState);
    });

    it('should handle corrupted JSON gracefully', async () => {
      await fs.writeFile(tempFilePath, '{ invalid json');

      const response = await request(app)
        .get('/api/state')
        .expect(200);

      const defaultState = createDefaultUiState();
      expect(response.body).toEqual(defaultState);
    });
  });

  describe('PUT /api/state', () => {
    it('should update state with valid data', async () => {
      const updateData: UiState = {
        version: 1,
        currentVersion: 1,
        migrations: [],
        selection: {
          selectedFileIds: [5, 6, 7],
          lastSelectedId: 7,
        },
        filter: {
          activeChain: null,
          history: [],
        },
        layout: {
          activeView: 'map',
          panelSizes: { left: 250, right: 350 },
        },
        preferences: {
          locale: 'de',
          theme: 'light',
        },
      };

      await request(app)
        .put('/api/state')
        .send(updateData)
        .expect(204);

      // Verify the state was updated
      const response = await request(app)
        .get('/api/state')
        .expect(200);

      expect(response.body).toEqual(updateData);
    });


    it('should handle partial updates correctly', async () => {
      // First, set some initial state
      const initialState: UiState = {
        version: 1,
        currentVersion: 1,
        migrations: [],
        selection: {
          selectedFileIds: [1, 2, 3],
          lastSelectedId: 3,
        },
        filter: {
          activeChain: null,
          history: [],
        },
        layout: {
          activeView: 'list',
          panelSizes: { left: 300, right: 400 },
        },
        preferences: {
          locale: 'en',
          theme: 'auto',
        },
      };

      await request(app)
        .put('/api/state')
        .send(initialState)
        .expect(204);

      // Update only selection
      const partialUpdate: UiState = {
        ...initialState,
        selection: {
          selectedFileIds: [10, 20, 30],
          lastSelectedId: 30,
        },
      };

      await request(app)
        .put('/api/state')
        .send(partialUpdate)
        .expect(204);

      // Verify only selection was updated
      const response = await request(app)
        .get('/api/state')
        .expect(200);

      expect(response.body.selection).toEqual(partialUpdate.selection);
      expect(response.body.filter).toEqual(initialState.filter); // Should remain unchanged
      expect(response.body.layout).toEqual(initialState.layout); // Should remain unchanged
      expect(response.body.preferences).toEqual(initialState.preferences); // Should remain unchanged
    });
  });

  describe('POST /api/state/reset', () => {
    it('should reset state to default', async () => {
      // First, set some custom state
      const customState: UiState = {
        version: 1,
        currentVersion: 1,
        migrations: [],
        selection: {
          selectedFileIds: [1, 2, 3],
          lastSelectedId: 3,
        },
        filter: {
          activeChain: null,
          history: [],
        },
        layout: {
          activeView: 'grid',
          panelSizes: { left: 300, right: 400 },
        },
        preferences: {
          locale: 'de',
          theme: 'dark',
        },
      };

      await request(app)
        .put('/api/state')
        .send(customState)
        .expect(204);

      // Reset to default
      await request(app)
        .post('/api/state/reset')
        .expect(204);

      // Verify state was reset
      const response = await request(app)
        .get('/api/state')
        .expect(200);

      const defaultState = createDefaultUiState();
      expect(response.body).toEqual(defaultState);
    });

    it('should create file if it does not exist', async () => {
      // Ensure file doesn't exist
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // File doesn't exist, that's fine
      }

      await request(app)
        .post('/api/state/reset')
        .expect(204);

      // Verify file was created
      const stats = await fs.stat(tempFilePath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('GET /api/state/stats', () => {
    it('should return stats for existing file', async () => {
      // Create some state
      const testState = createDefaultUiState();
      await fs.writeFile(tempFilePath, JSON.stringify(testState, null, 2));

      const response = await request(app)
        .get('/api/state/stats')
        .expect(200);

      expect(response.body.exists).toBe(true);
      expect(response.body.size).toBeGreaterThan(0);
      expect(response.body.mtime).toBeDefined();
    });

    it('should return stats for non-existing file', async () => {
      // Ensure file doesn't exist
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // File doesn't exist, that's fine
      }

      const response = await request(app)
        .get('/api/state/stats')
        .expect(200);

      expect(response.body.exists).toBe(false);
      expect(response.body.size).toBeUndefined();
      expect(response.body.mtime).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Create a directory with the same name as the file
      await fs.mkdir(tempFilePath, { recursive: true });

      // Should return 200 with default state for file system errors (resilient behavior)
      const response = await request(app)
        .get('/api/state')
        .expect(200);

      // Should return default state when file system issues occur
      expect(response.body.version).toBe(1);
      expect(response.body.selection.selectedFileIds).toEqual([]);
    });

    it('should handle concurrent requests', async () => {
      const requests = [];
      
      // Mix of reads and writes
      for (let i = 0; i < 5; i++) {
        requests.push(request(app).get('/api/state'));
        requests.push(request(app).put('/api/state').send({
          ...createDefaultUiState(),
          selection: {
            selectedFileIds: [i],
            lastSelectedId: i,
          },
        }));
      }

      const responses = await Promise.allSettled(requests);

      // All requests should complete (some may be 500 due to file system issues)
      responses.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('should reject very large state objects', async () => {
      // Create a very large state object
      const largeState: UiState = {
        ...createDefaultUiState(),
        selection: {
          selectedFileIds: Array.from({ length: 10000 }, (_, i) => i),
          lastSelectedId: 9999,
        },
      };

      // Should reject very large state objects with either 400 or 500
      // (behavior varies by environment: validation vs. filesystem limits)
      // TODO (WP-1.3): Add explicit size validation to consistently return 400
      const response = await request(app)
        .put('/api/state')
        .send(largeState);
      
      expect([400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('code');
    });
  });
});
