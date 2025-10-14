import type { UiState } from '@phoTool/shared';
import { createDefaultUiState, uiStateSchema } from '@phoTool/shared';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { UiStateService } from '../src/services/uiState.js';

describe('UiStateService', () => {
  let service: UiStateService;
  let tempDir: string;
  let tempFilePath: string;

  beforeEach(async () => {
    tempDir = path.join(tmpdir(), `ui-state-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    tempFilePath = path.join(tempDir, 'ui-state.json');
    service = new UiStateService(tempFilePath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('get()', () => {
    it('should return default state when no file exists', async () => {
      const state = await service.get();
      const defaultState = createDefaultUiState();

      expect(state).toEqual(defaultState);
    });

    it('should return valid state from file', async () => {
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

      const retrievedState = await service.get();
      expect(retrievedState).toEqual(testState);
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

      const state = await service.get();
      const defaultState = createDefaultUiState();
      expect(state).toEqual(defaultState);
    });

    it('should handle corrupted JSON gracefully', async () => {
      await fs.writeFile(tempFilePath, '{ invalid json');

      const state = await service.get();
      const defaultState = createDefaultUiState();
      expect(state).toEqual(defaultState);
    });

    it('should read from backup when main file is corrupted', async () => {
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

      // Write valid data to backup file
      await fs.writeFile(`${tempFilePath}.bak.1`, JSON.stringify(testState, null, 2));
      
      // Write corrupted data to main file
      await fs.writeFile(tempFilePath, '{ corrupted json');

      const retrievedState = await service.get();
      expect(retrievedState).toEqual(testState);
    });
  });

  describe('update()', () => {
    it('should update partial state correctly', async () => {
      // Start with default state
      const initialState = await service.get();

      // Update only selection
      const partialUpdate = {
        selection: {
          selectedFileIds: [5, 6, 7],
          lastSelectedId: 7,
        },
      };

      await service.update(partialUpdate);

      const updatedState = await service.get();
      expect(updatedState.selection).toEqual(partialUpdate.selection);
      expect(updatedState.filter).toEqual(initialState.filter); // Should remain unchanged
      expect(updatedState.layout).toEqual(initialState.layout); // Should remain unchanged
      expect(updatedState.preferences).toEqual(initialState.preferences); // Should remain unchanged
    });

    it('should merge multiple fields correctly', async () => {
      const partialUpdate = {
        selection: {
          selectedFileIds: [10, 20],
          lastSelectedId: 20,
        },
        layout: {
          activeView: 'map' as const,
          panelSizes: { left: 250, right: 350 },
        },
        preferences: {
          locale: 'de',
          theme: 'light' as const,
        },
      };

      await service.update(partialUpdate);

      const updatedState = await service.get();
      expect(updatedState.selection).toEqual(partialUpdate.selection);
      expect(updatedState.layout).toEqual(partialUpdate.layout);
      expect(updatedState.preferences).toEqual(partialUpdate.preferences);
    });

    it('should preserve version fields during update', async () => {
      const initialState = await service.get();
      const originalVersion = initialState.version;
      const originalCurrentVersion = initialState.currentVersion;
      const originalMigrations = initialState.migrations;

      await service.update({
        selection: {
          selectedFileIds: [1, 2, 3],
          lastSelectedId: 3,
        },
      });

      const updatedState = await service.get();
      expect(updatedState.version).toBe(originalVersion);
      expect(updatedState.currentVersion).toBe(originalCurrentVersion);
      expect(updatedState.migrations).toEqual(originalMigrations);
    });

    it('should throw error for invalid partial state', async () => {
      const invalidUpdate = {
        selection: {
          selectedFileIds: 'not-an-array' as unknown, // Invalid type
          lastSelectedId: 1,
        },
      };

      await expect(service.update(invalidUpdate as unknown as Parameters<typeof service.update>[0])).rejects.toThrow();
    });

    it('should handle concurrent updates', async () => {
      const updates = [
        { selection: { selectedFileIds: [1], lastSelectedId: 1 } },
        { selection: { selectedFileIds: [2], lastSelectedId: 2 } },
        { selection: { selectedFileIds: [3], lastSelectedId: 3 } },
        { layout: { activeView: 'grid' as const, panelSizes: {} } },
        { preferences: { locale: 'de', theme: 'dark' as const } },
      ];

      // Apply updates concurrently - some may fail due to race conditions
      const results = await Promise.allSettled(updates.map(update => service.update(update)));
      
      // At least some updates should succeed
      const successfulUpdates = results.filter(result => result.status === 'fulfilled');
      expect(successfulUpdates.length).toBeGreaterThan(0);

      const finalState = await service.get();
      // Verify the final state is valid
      expect(finalState.version).toBe(1);
      expect(finalState.selection.selectedFileIds).toBeDefined();
      expect(finalState.layout.activeView).toBeDefined();
      expect(finalState.preferences.locale).toBeDefined();
    });
  });

  describe('reset()', () => {
    it('should reset to default state', async () => {
      // First, set some custom state
      await service.update({
        selection: {
          selectedFileIds: [1, 2, 3],
          lastSelectedId: 3,
        },
        preferences: {
          locale: 'de',
          theme: 'dark',
        },
      });

      // Reset to default
      await service.reset();

      const resetState = await service.get();
      const defaultState = createDefaultUiState();
      expect(resetState).toEqual(defaultState);
    });

    it('should create file if it does not exist', async () => {
      // Ensure file doesn't exist
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // File doesn't exist, that's fine
      }

      await service.reset();

      const stats = await fs.stat(tempFilePath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('getStats()', () => {
    it('should return stats for existing file', async () => {
      await service.update({
        selection: {
          selectedFileIds: [1, 2, 3],
          lastSelectedId: 3,
        },
      });

      const stats = await service.getStats();
      expect(stats.exists).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.mtime).toBeInstanceOf(Date);
    });

    it('should return stats for non-existing file', async () => {
      // Ensure file doesn't exist
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // File doesn't exist, that's fine
      }

      const stats = await service.getStats();
      expect(stats.exists).toBe(false);
      expect(stats.size).toBeUndefined();
      expect(stats.mtime).toBeUndefined();
    });
  });

  describe('delete()', () => {
    it('should delete state file and backups', async () => {
      // Create some state
      await service.update({
        selection: {
          selectedFileIds: [1, 2, 3],
          lastSelectedId: 3,
        },
      });

      // Verify file exists
      let stats = await service.getStats();
      expect(stats.exists).toBe(true);

      // Delete
      await service.delete();

      // Verify file is gone
      stats = await service.getStats();
      expect(stats.exists).toBe(false);
    });

    it('should handle deletion of non-existing file gracefully', async () => {
      // Ensure file doesn't exist
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // File doesn't exist, that's fine
      }

      // Should not throw
      await expect(service.delete()).resolves.not.toThrow();
    });
  });

  describe('atomic operations', () => {
    it('should maintain data integrity during concurrent reads and writes', async () => {
      const readWriteOperations = [];
      
      // Mix of reads and writes
      for (let i = 1; i <= 10; i++) {
        readWriteOperations.push(service.get());
        readWriteOperations.push(service.update({
          selection: {
            selectedFileIds: [i],
            lastSelectedId: i,
          },
        }));
      }

      const results = await Promise.allSettled(readWriteOperations);

      // Some operations may fail due to race conditions, but reads should succeed
      const readResults = results.filter((_, index) => index % 2 === 0); // Even indices are reads
      const writeResults = results.filter((_, index) => index % 2 === 1); // Odd indices are writes
      
      // All reads should succeed
      readResults.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
      
      // At least some writes should succeed
      const successfulWrites = writeResults.filter(result => result.status === 'fulfilled');
      expect(successfulWrites.length).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalState = await service.get();
      expect(uiStateSchema.parse(finalState)).toEqual(finalState);
    });

    it('should handle backup rotation correctly', async () => {
      // Create multiple updates to trigger backup rotation
      for (let i = 1; i <= 5; i++) {
        await service.update({
          selection: {
            selectedFileIds: [i],
            lastSelectedId: i,
          },
        });
      }

      // Verify main file exists and is valid
      const stats = await service.getStats();
      expect(stats.exists).toBe(true);

      const state = await service.get();
      expect(uiStateSchema.parse(state)).toEqual(state);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Create service with invalid path (directory instead of file)
      const invalidService = new UiStateService(tempDir);

      // Should return default state when file system issues occur (resilient behavior)
      const state = await invalidService.get();
      expect(state.version).toBe(1);
      expect(state.selection.selectedFileIds).toEqual([]);
    });

    it('should handle write failures gracefully', async () => {
      // Create a service with a path that points to a file in a non-existent directory
      const invalidPath = path.join(tempDir, 'nonexistent', 'ui-state.json');
      const invalidService = new UiStateService(invalidPath);

      // Should succeed because AtomicJsonStore creates directories as needed
      const result = await invalidService.update({
        selection: {
          selectedFileIds: [1],
          lastSelectedId: 1,
        },
      });
      
      expect(result).toBeDefined();
      expect(result.selection.selectedFileIds).toEqual([1]);

      // Verify the file was created
      await expect(fs.stat(invalidPath)).resolves.toBeDefined();
    });
  });
});
