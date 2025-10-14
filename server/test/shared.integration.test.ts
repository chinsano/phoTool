import {
  uiStateSchema,
  createDefaultUiState,
  migrateUiState,
  apiErrorSchema,
  createApiError,
  isApiError,
  API_ERROR_CODES,
  smartAlbumSchema,
  createDefaultAlbum,
  getAlbumFilePath,
  getAlbumIdFromFilename,
  type AlbumId,
  type ApiError,
} from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('Shared Contracts Integration', () => {
  describe('UI State + API Error Integration', () => {
    it('should handle API errors in UI state context', () => {
      // Simulate an API error during UI state update
      const apiError: ApiError = createApiError(
        400,
        API_ERROR_CODES.VALIDATION_ERROR,
        'Invalid UI state update',
        { field: 'selection', reason: 'invalid file ID' }
      );

      expect(isApiError(apiError)).toBe(true);
      expect(apiErrorSchema.parse(apiError)).toEqual(apiError);

      // UI state should remain valid even when API errors occur
      const uiState = createDefaultUiState();
      const validatedState = uiStateSchema.parse(uiState);
      expect(validatedState).toEqual(uiState);
    });

    it('should handle UI state migration with API error context', () => {
      const oldState = {
        version: 1,
        currentVersion: 1,
        migrations: [],
        selection: { selectedFileIds: [1, 2, 3], lastSelectedId: 2 },
        filter: { activeChain: null, history: [] },
        layout: { activeView: 'list', panelSizes: {} },
        preferences: { locale: 'en', theme: 'auto' },
      };

      const migratedState = migrateUiState(oldState);
      expect(migratedState.version).toBe(1);
      expect(migratedState.selection.selectedFileIds).toEqual([1, 2, 3]);

      // API error should not affect state migration
      const apiError = createApiError(500, API_ERROR_CODES.INTERNAL_ERROR, 'Migration failed');
      expect(isApiError(apiError)).toBe(true);
    });
  });

  describe('Albums + UI State Integration', () => {
    it('should create album and update UI state consistently', () => {
      // Create a default album
      const album = createDefaultAlbum('Test Album', ['/path/to/photos']);
      const validatedAlbum = smartAlbumSchema.parse(album);
      expect(validatedAlbum.name).toBe('Test Album');

      // Create UI state that references this album
      const uiState = createDefaultUiState();
      uiState.selection.selectedFileIds = [1, 2, 3];
      uiState.layout.activeView = 'grid';

      const validatedState = uiStateSchema.parse(uiState);
      expect(validatedState.selection.selectedFileIds).toEqual([1, 2, 3]);
      expect(validatedState.layout.activeView).toBe('grid');
    });

    it('should handle album file operations with UI state persistence', () => {
      const albumId: AlbumId = 'test-album-123';
      const filePath = getAlbumFilePath(albumId);
      expect(filePath).toBe('data/albums/test-album-123.json');

      // Extract ID back from filename
      const extractedId = getAlbumIdFromFilename('test-album-123.json');
      expect(extractedId).toBe(albumId);

      // UI state should be able to reference this album
      const uiState = createDefaultUiState();
      uiState.preferences.locale = 'de';
      uiState.preferences.theme = 'dark';

      const validatedState = uiStateSchema.parse(uiState);
      expect(validatedState.preferences.locale).toBe('de');
      expect(validatedState.preferences.theme).toBe('dark');
    });
  });

  describe('API Client + Albums Integration', () => {
    it('should handle API responses for album operations', () => {
      // Simulate successful album creation API response
      const album = createDefaultAlbum('API Test Album', ['/api/path']);
      smartAlbumSchema.parse(album);

      // Simulate API error for album operation
      const apiError = createApiError(
        404,
        API_ERROR_CODES.NOT_FOUND,
        'Album not found',
        { albumId: 'missing-album' }
      );

      expect(isApiError(apiError)).toBe(true);
      expect(apiError.status).toBe(404);
      expect(apiError.code).toBe(API_ERROR_CODES.NOT_FOUND);
    });

    it('should handle concurrent album and UI state operations', () => {
      // Simulate multiple album operations
      const albums = [
        createDefaultAlbum('Album 1', ['/path1']),
        createDefaultAlbum('Album 2', ['/path2']),
        createDefaultAlbum('Album 3', ['/path3']),
      ];

      albums.forEach(album => {
        const validated = smartAlbumSchema.parse(album);
        expect(validated.version).toBe(1);
      });

      // Simulate UI state updates during album operations
      const uiState = createDefaultUiState();
      uiState.selection.selectedFileIds = [1, 2, 3, 4, 5];
      uiState.filter.history = [{ some: 'filter' }, { another: 'filter' }];

      const validatedState = uiStateSchema.parse(uiState);
      expect(validatedState.selection.selectedFileIds).toHaveLength(5);
      expect(validatedState.filter.history).toHaveLength(2);
    });
  });

  describe('Schema Evolution Integration', () => {
    it('should handle schema versioning across modules', () => {
      // UI State with versioning
      const uiState = createDefaultUiState();
      expect(uiState.version).toBe(1);
      expect(uiState.currentVersion).toBe(1);

      // Album with versioning
      const album = createDefaultAlbum('Versioned Album', ['/path']);
      expect(album.version).toBe(1);

      // API Error with status codes
      const apiError = createApiError(400, API_ERROR_CODES.VALIDATION_ERROR, 'Version mismatch');
      expect(apiError.status).toBe(400);

      // All should work together
      const migratedUiState = migrateUiState(uiState);
      const validatedAlbum = smartAlbumSchema.parse(album);
      const validatedError = apiErrorSchema.parse(apiError);

      expect(migratedUiState.version).toBe(1);
      expect(validatedAlbum.version).toBe(1);
      expect(validatedError.status).toBe(400);
    });

    it('should maintain consistency across schema updates', () => {
      // Test that all schemas can handle their expected data types
      const testData = {
        uiState: createDefaultUiState(),
        album: createDefaultAlbum('Consistency Test', ['/test/path']),
        apiError: createApiError(500, API_ERROR_CODES.INTERNAL_ERROR, 'Test error'),
      };

      // All should validate successfully
      const validatedUiState = uiStateSchema.parse(testData.uiState);
      const validatedAlbum = smartAlbumSchema.parse(testData.album);
      const validatedError = apiErrorSchema.parse(testData.apiError);

      expect(validatedUiState).toBeDefined();
      expect(validatedAlbum).toBeDefined();
      expect(validatedError).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle cascading errors across modules', () => {
      // Simulate error in album creation
      const albumError = createApiError(
        400,
        API_ERROR_CODES.VALIDATION_ERROR,
        'Invalid album data',
        { field: 'sources', reason: 'empty array' }
      );

      // Simulate error in UI state update
      const uiStateError = createApiError(
        500,
        API_ERROR_CODES.INTERNAL_ERROR,
        'UI state persistence failed',
        { operation: 'update', reason: 'file system error' }
      );

      // Both errors should be valid
      expect(isApiError(albumError)).toBe(true);
      expect(isApiError(uiStateError)).toBe(true);

      // UI state should remain in valid default state
      const defaultState = createDefaultUiState();
      const validatedState = uiStateSchema.parse(defaultState);
      expect(validatedState).toEqual(defaultState);
    });

    it('should handle partial failures gracefully', () => {
      // Simulate partial album data (missing required fields)
      const partialAlbum = {
        version: 1,
        name: 'Partial Album',
        // Missing sources and filter
      };

      // Should fail validation
      expect(() => smartAlbumSchema.parse(partialAlbum)).toThrow();

      // But UI state should still work
      const uiState = createDefaultUiState();
      const validatedState = uiStateSchema.parse(uiState);
      expect(validatedState).toBeDefined();

      // API error should still be valid
      const error = createApiError(400, API_ERROR_CODES.VALIDATION_ERROR, 'Partial data');
      expect(isApiError(error)).toBe(true);
    });
  });
});
