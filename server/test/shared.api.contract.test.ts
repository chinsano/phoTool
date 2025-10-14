import {
  apiErrorSchema,
  type ApiError,
  type ApiResponse,
  type ApiRequestOptions,
  type HttpMethod,
  type ApiClientConfig,
  API_ERROR_CODES,
  type ApiErrorCode,
  isApiError,
  createApiError,
  API_ENDPOINTS,
  buildQueryString,
  buildUrl,
} from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('API Client Contracts', () => {
  describe('apiErrorSchema', () => {
    it('should parse valid API error', () => {
      const valid: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: { field: 'name', reason: 'required' },
      };
      
      const result = apiErrorSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should parse API error without details', () => {
      const valid: ApiError = {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Resource not found',
      };
      
      const result = apiErrorSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should reject invalid status codes', () => {
      const invalid = {
        status: 99, // too low
        code: 'INVALID',
        message: 'Test error',
      };
      
      expect(() => apiErrorSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid status codes (too high)', () => {
      const invalid = {
        status: 600, // too high
        code: 'INVALID',
        message: 'Test error',
      };
      
      expect(() => apiErrorSchema.parse(invalid)).toThrow();
    });

    it('should reject empty code', () => {
      const invalid = {
        status: 400,
        code: '',
        message: 'Test error',
      };
      
      expect(() => apiErrorSchema.parse(invalid)).toThrow();
    });

    it('should reject empty message', () => {
      const invalid = {
        status: 400,
        code: 'ERROR',
        message: '',
      };
      
      expect(() => apiErrorSchema.parse(invalid)).toThrow();
    });
  });

  describe('ApiResponse type', () => {
    it('should handle success response', () => {
      const success: ApiResponse<{ id: number }> = {
        ok: true,
        data: { id: 123 },
      };
      
      expect(success.ok).toBe(true);
      if (success.ok) {
        expect(success.data.id).toBe(123);
      }
    });

    it('should handle error response', () => {
      const error: ApiResponse<never> = {
        ok: false,
        error: {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
      };
      
      expect(error.ok).toBe(false);
      if (!error.ok) {
        expect(error.error.status).toBe(400);
        expect(error.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('API_ERROR_CODES', () => {
    it('should contain expected error codes', () => {
      expect(API_ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(API_ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(API_ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(API_ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(API_ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(API_ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(API_ERROR_CODES.TIMEOUT).toBe('TIMEOUT');
    });

    it('should have correct type for error codes', () => {
      const code: ApiErrorCode = API_ERROR_CODES.VALIDATION_ERROR;
      expect(typeof code).toBe('string');
    });
  });

  describe('isApiError', () => {
    it('should identify valid API error', () => {
      const error: ApiError = {
        status: 400,
        code: 'ERROR',
        message: 'Test error',
      };
      
      expect(isApiError(error)).toBe(true);
    });

    it('should reject invalid API error', () => {
      const notError = { message: 'Not an API error' };
      expect(isApiError(notError)).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
    });
  });

  describe('createApiError', () => {
    it('should create valid API error', () => {
      const error = createApiError(400, 'TEST_ERROR', 'Test message', { extra: 'data' });
      
      expect(error.status).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ extra: 'data' });
    });

    it('should create API error without details', () => {
      const error = createApiError(404, 'NOT_FOUND', 'Resource not found');
      
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.details).toBeUndefined();
    });
  });

  describe('API_ENDPOINTS', () => {
    it('should contain all expected endpoints', () => {
      expect(API_ENDPOINTS.HEALTH).toBe('/api/health');
      expect(API_ENDPOINTS.SCAN).toBe('/api/scan');
      expect(API_ENDPOINTS.SCAN_STATUS).toBe('/api/scan/status');
      expect(API_ENDPOINTS.FILES_SEARCH).toBe('/api/files/search');
      expect(API_ENDPOINTS.TAGS).toBe('/api/tags');
      expect(API_ENDPOINTS.TAG_GROUPS).toBe('/api/tag-groups');
      expect(API_ENDPOINTS.AGGREGATIONS).toBe('/api/aggregations');
      expect(API_ENDPOINTS.LIBRARY).toBe('/api/library');
      expect(API_ENDPOINTS.SYNC).toBe('/api/sync');
      expect(API_ENDPOINTS.EXPAND_PLACEHOLDER).toBe('/api/expand-placeholder');
      expect(API_ENDPOINTS.ALBUMS).toBe('/api/albums');
      expect(API_ENDPOINTS.UI_STATE).toBe('/api/state');
      expect(API_ENDPOINTS.TUTORIALS).toBe('/api/tutorials');
    });

    it('should generate parameterized endpoints correctly', () => {
      expect(API_ENDPOINTS.FILES_THUMBNAIL(123)).toBe('/api/files/123/thumbnail');
      expect(API_ENDPOINTS.FILE_TAGS(456)).toBe('/api/files/456/tags');
      expect(API_ENDPOINTS.TAG(789)).toBe('/api/tags/789');
      expect(API_ENDPOINTS.TAG_GROUP(101)).toBe('/api/tag-groups/101');
      expect(API_ENDPOINTS.TAG_GROUP_ITEMS(202)).toBe('/api/tag-groups/202/items');
      expect(API_ENDPOINTS.ALBUM('test-album')).toBe('/api/albums/test-album');
      expect(API_ENDPOINTS.I18N('en')).toBe('/i18n/en/ui.json');
      expect(API_ENDPOINTS.TUTORIAL('tutorial-1')).toBe('/api/tutorials/tutorial-1');
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from params', () => {
      const params = {
        page: 1,
        limit: 10,
        search: 'test',
        active: true,
      };
      
      const result = buildQueryString(params);
      expect(result).toBe('page=1&limit=10&search=test&active=true');
    });

    it('should handle empty params', () => {
      const result = buildQueryString({});
      expect(result).toBe('');
    });

    it('should handle single param', () => {
      const result = buildQueryString({ id: 123 });
      expect(result).toBe('id=123');
    });

    it('should URL encode values', () => {
      const params = {
        search: 'hello world',
        filter: 'test&value',
      };
      
      const result = buildQueryString(params);
      expect(result).toBe('search=hello+world&filter=test%26value');
    });
  });

  describe('buildUrl', () => {
    it('should build URL with base and endpoint', () => {
      const result = buildUrl('http://localhost:5000', '/api/health');
      expect(result).toBe('http://localhost:5000/api/health');
    });

    it('should build URL with query params', () => {
      const result = buildUrl(
        'http://localhost:5000',
        '/api/files/search',
        { page: 1, limit: 10 }
      );
      expect(result).toBe('http://localhost:5000/api/files/search?page=1&limit=10');
    });

    it('should handle empty query params', () => {
      const result = buildUrl('http://localhost:5000', '/api/health', {});
      expect(result).toBe('http://localhost:5000/api/health');
    });

    it('should handle undefined query params', () => {
      const result = buildUrl('http://localhost:5000', '/api/health');
      expect(result).toBe('http://localhost:5000/api/health');
    });
  });

  describe('Type safety', () => {
    it('should enforce HttpMethod type', () => {
      const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      validMethods.forEach(method => {
        expect(typeof method).toBe('string');
      });
    });

    it('should enforce ApiRequestOptions structure', () => {
      const options: ApiRequestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { test: 'data' },
        query: { page: 1 },
      };
      
      expect(options.method).toBe('POST');
      expect(options.headers).toBeDefined();
      expect(options.body).toBeDefined();
      expect(options.query).toBeDefined();
    });

    it('should enforce ApiClientConfig structure', () => {
      const config: ApiClientConfig = {
        baseUrl: 'http://localhost:5000',
        timeout: 5000,
        defaultHeaders: { 'User-Agent': 'phoTool' },
      };
      
      expect(config.baseUrl).toBe('http://localhost:5000');
      expect(config.timeout).toBe(5000);
      expect(config.defaultHeaders).toBeDefined();
    });
  });
});
