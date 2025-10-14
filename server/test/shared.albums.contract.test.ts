import {
  smartAlbumSchema,
  albumIdSchema,
  createAlbumRequestSchema,
  updateAlbumRequestSchema,
  albumDetailResponseSchema,
  albumListItemSchema,
  albumListResponseSchema,
  getAlbumFilePath,
  getAlbumIdFromFilename,
  createDefaultAlbum,
  type SmartAlbum,
  type AlbumId,
  type CreateAlbumRequest,
  type UpdateAlbumRequest,
  type AlbumDetailResponse,
  type AlbumListItem,
  type AlbumListResponse,
} from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('Albums Contracts', () => {
  describe('smartAlbumSchema', () => {
    it('should parse valid smart album', () => {
      const valid: SmartAlbum = {
        version: 1,
        name: 'My Photos',
        sources: ['/path/to/photos'],
        filter: { start: { id: '1', mode: 'all', tagIds: [] }, links: [] },
      };
      
      const result = smartAlbumSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should reject invalid version', () => {
      const invalid = {
        version: 2,
        name: 'My Photos',
        sources: ['/path/to/photos'],
        filter: null,
      };
      
      expect(() => smartAlbumSchema.parse(invalid)).toThrow();
    });

    it('should reject empty name', () => {
      const invalid = {
        version: 1,
        name: '',
        sources: ['/path/to/photos'],
        filter: null,
      };
      
      expect(() => smartAlbumSchema.parse(invalid)).toThrow();
    });

    it('should reject name too long', () => {
      const invalid = {
        version: 1,
        name: 'a'.repeat(256),
        sources: ['/path/to/photos'],
        filter: null,
      };
      
      expect(() => smartAlbumSchema.parse(invalid)).toThrow();
    });

    it('should reject empty sources array', () => {
      const invalid = {
        version: 1,
        name: 'My Photos',
        sources: [],
        filter: null,
      };
      
      expect(() => smartAlbumSchema.parse(invalid)).toThrow();
    });

    it('should reject empty source path', () => {
      const invalid = {
        version: 1,
        name: 'My Photos',
        sources: [''],
        filter: null,
      };
      
      expect(() => smartAlbumSchema.parse(invalid)).toThrow();
    });

    it('should accept multiple sources', () => {
      const valid: SmartAlbum = {
        version: 1,
        name: 'Multiple Sources',
        sources: ['/path1', '/path2', '/path3'],
        filter: null,
      };
      
      const result = smartAlbumSchema.parse(valid);
      expect(result).toEqual(valid);
    });
  });

  describe('albumIdSchema', () => {
    it('should accept valid album IDs', () => {
      const validIds = ['album1', 'my-album', 'album_123', 'Album-Name'];
      
      validIds.forEach(id => {
        const result = albumIdSchema.parse(id);
        expect(result).toBe(id);
      });
    });

    it('should reject invalid album IDs', () => {
      const invalidIds = ['', 'album with spaces', 'album@special', 'album.dots', 'album/slash'];
      
      invalidIds.forEach(id => {
        expect(() => albumIdSchema.parse(id)).toThrow();
      });
    });

    it('should reject IDs that are too long', () => {
      const longId = 'a'.repeat(256);
      expect(() => albumIdSchema.parse(longId)).toThrow();
    });
  });

  describe('createAlbumRequestSchema', () => {
    it('should parse valid create request', () => {
      const valid: CreateAlbumRequest = {
        name: 'New Album',
        sources: ['/path/to/photos'],
        filter: { start: { id: '1', mode: 'all', tagIds: [] }, links: [] },
      };
      
      const result = createAlbumRequestSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should reject invalid create request', () => {
      const invalid = {
        name: '',
        sources: [],
        filter: null,
      };
      
      expect(() => createAlbumRequestSchema.parse(invalid)).toThrow();
    });
  });

  describe('updateAlbumRequestSchema', () => {
    it('should parse valid update request with all fields', () => {
      const valid: UpdateAlbumRequest = {
        name: 'Updated Album',
        sources: ['/new/path'],
        filter: { start: { id: '1', mode: 'any', tagIds: ['tag1'] }, links: [] },
      };
      
      const result = updateAlbumRequestSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should parse valid update request with partial fields', () => {
      const valid: UpdateAlbumRequest = {
        name: 'Updated Name',
      };
      
      const result = updateAlbumRequestSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should parse empty update request', () => {
      const valid: UpdateAlbumRequest = {};
      
      const result = updateAlbumRequestSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should reject invalid update request', () => {
      const invalid = {
        name: '',
        sources: [],
      };
      
      expect(() => updateAlbumRequestSchema.parse(invalid)).toThrow();
    });
  });

  describe('albumDetailResponseSchema', () => {
    it('should parse valid album detail response', () => {
      const valid: AlbumDetailResponse = {
        id: 'album-123',
        version: 1,
        name: 'My Album',
        sources: ['/path/to/photos'],
        filter: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      
      const result = albumDetailResponseSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should reject invalid datetime format', () => {
      const invalid = {
        id: 'album-123',
        version: 1,
        name: 'My Album',
        sources: ['/path/to/photos'],
        filter: null,
        createdAt: 'invalid-date',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      
      expect(() => albumDetailResponseSchema.parse(invalid)).toThrow();
    });
  });

  describe('albumListItemSchema', () => {
    it('should parse valid album list item', () => {
      const valid: AlbumListItem = {
        id: 'album-123',
        name: 'My Album',
        sources: ['/path/to/photos'],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      
      const result = albumListItemSchema.parse(valid);
      expect(result).toEqual(valid);
    });
  });

  describe('albumListResponseSchema', () => {
    it('should parse valid album list response', () => {
      const valid: AlbumListResponse = {
        albums: [
          {
            id: 'album-1',
            name: 'Album 1',
            sources: ['/path1'],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'album-2',
            name: 'Album 2',
            sources: ['/path2'],
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
      };
      
      const result = albumListResponseSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should parse empty album list', () => {
      const valid: AlbumListResponse = {
        albums: [],
      };
      
      const result = albumListResponseSchema.parse(valid);
      expect(result).toEqual(valid);
    });
  });

  describe('getAlbumFilePath', () => {
    it('should generate correct file path', () => {
      const id: AlbumId = 'my-album';
      const result = getAlbumFilePath(id);
      expect(result).toBe('data/albums/my-album.json');
    });

    it('should handle complex album IDs', () => {
      const id: AlbumId = 'album_123-test';
      const result = getAlbumFilePath(id);
      expect(result).toBe('data/albums/album_123-test.json');
    });
  });

  describe('getAlbumIdFromFilename', () => {
    it('should extract valid album ID from filename', () => {
      const filename = 'my-album.json';
      const result = getAlbumIdFromFilename(filename);
      expect(result).toBe('my-album');
    });

    it('should return null for invalid filename', () => {
      const invalidFilenames = [
        'my-album.txt',
        'my album.json',
        'my@album.json',
        'my.album.json',
        'my/album.json',
        'my-album',
      ];
      
      invalidFilenames.forEach(filename => {
        const result = getAlbumIdFromFilename(filename);
        expect(result).toBeNull();
      });
    });

    it('should handle complex filenames', () => {
      const filename = 'album_123-test.json';
      const result = getAlbumIdFromFilename(filename);
      expect(result).toBe('album_123-test');
    });
  });

  describe('createDefaultAlbum', () => {
    it('should create valid default album', () => {
      const name = 'Default Album';
      const sources = ['/path/to/photos'];
      
      const result = createDefaultAlbum(name, sources);
      
      expect(result.version).toBe(1);
      expect(result.name).toBe(name);
      expect(result.sources).toEqual(sources);
      expect(result.filter).toBeNull();
    });

    it('should create album with multiple sources', () => {
      const name = 'Multi Source Album';
      const sources = ['/path1', '/path2', '/path3'];
      
      const result = createDefaultAlbum(name, sources);
      
      expect(result.sources).toEqual(sources);
    });

    it('should create valid album that passes schema validation', () => {
      const name = 'Valid Album';
      const sources = ['/path/to/photos'];
      
      const result = createDefaultAlbum(name, sources);
      const validated = smartAlbumSchema.parse(result);
      
      expect(validated).toEqual(result);
    });
  });
});
