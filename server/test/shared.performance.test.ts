import {
  uiStateSchema,
  apiErrorSchema,
  smartAlbumSchema,
  createDefaultUiState,
  createDefaultAlbum,
  createApiError,
  API_ERROR_CODES,
} from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('Performance Benchmarks', () => {
  describe('Schema Parsing Performance', () => {
    it('should parse UI state schemas efficiently', () => {
      const uiState = createDefaultUiState();
      
      const startTime = performance.now();
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        uiStateSchema.parse(uiState);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;
      
      // Should parse in less than 1ms per iteration
      expect(avgTime).toBeLessThan(1);
    });

    it('should parse album schemas efficiently', () => {
      const album = createDefaultAlbum('Performance Test', ['/path/to/photos']);
      
      const startTime = performance.now();
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        smartAlbumSchema.parse(album);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;
      
      // Should parse in less than 1ms per iteration
      expect(avgTime).toBeLessThan(1);
      // Performance benchmark: Album parsing
    });

    it('should parse API error schemas efficiently', () => {
      const apiError = createApiError(400, API_ERROR_CODES.VALIDATION_ERROR, 'Performance test');
      
      const startTime = performance.now();
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        apiErrorSchema.parse(apiError);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;
      
      // Should parse in less than 1ms per iteration
      expect(avgTime).toBeLessThan(1);
      // Performance benchmark: API Error parsing
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle UI state with many selected files efficiently', () => {
      const largeSelection = Array.from({ length: 10000 }, (_, i) => i + 1);
      const largeUiState = {
        version: 1,
        currentVersion: 1,
        migrations: [],
        selection: { selectedFileIds: largeSelection, lastSelectedId: 10000 },
        filter: { activeChain: null, history: [] },
        layout: { activeView: 'list' as const, panelSizes: {} },
        preferences: { locale: 'en', theme: 'auto' as const },
      };

      const startTime = performance.now();
      const validated = uiStateSchema.parse(largeUiState);
      const endTime = performance.now();
      const parseTime = endTime - startTime;

      // Should parse large UI state in less than 100ms (Windows and CI environments may be slower)
      expect(parseTime).toBeLessThan(100);
      expect(validated.selection.selectedFileIds).toHaveLength(10000);
      // Performance benchmark: Large UI State parsing
    });

    it('should handle album with many sources efficiently', () => {
      const manySources = Array.from({ length: 1000 }, (_, i) => `/path/to/source/${i}`);
      const largeAlbum = {
        version: 1 as const,
        name: 'Large Album with Many Sources',
        sources: manySources,
        filter: null,
      };

      const startTime = performance.now();
      const validated = smartAlbumSchema.parse(largeAlbum);
      const endTime = performance.now();
      const parseTime = endTime - startTime;

      // Increased threshold for CI environments (was 10ms)
      expect(parseTime).toBeLessThan(100);
      expect(validated.sources).toHaveLength(1000);
      // Performance benchmark: Large Album parsing
    });

    it('should handle API error with large details efficiently', () => {
      const largeDetails = {
        stack: 'Error: ' + 'x'.repeat(5000),
        context: Array.from({ length: 100 }, (_, i) => ({ field: `field${i}`, value: `value${i}` })),
        metadata: { timestamp: new Date().toISOString(), requestId: 'large-request-id' },
      };

      const largeError = createApiError(
        500,
        API_ERROR_CODES.INTERNAL_ERROR,
        'Large error details',
        largeDetails
      );

      const startTime = performance.now();
      const validated = apiErrorSchema.parse(largeError);
      const endTime = performance.now();
      const parseTime = endTime - startTime;

      // Should parse large error in less than 5ms
      expect(parseTime).toBeLessThan(5);
      expect(validated.details).toEqual(largeDetails);
      // Performance benchmark: Large API Error parsing
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory with repeated parsing', () => {
      const uiState = createDefaultUiState();
      const album = createDefaultAlbum('Memory Test', ['/path']);
      const apiError = createApiError(400, API_ERROR_CODES.VALIDATION_ERROR, 'Memory test');

      // Get initial memory usage (approximate)
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many parsing operations
      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        uiStateSchema.parse(uiState);
        smartAlbumSchema.parse(album);
        apiErrorSchema.parse(apiError);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 10k iterations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      // Performance benchmark: Memory usage
    });

    it('should handle concurrent parsing without memory issues', () => {
      const uiState = createDefaultUiState();
      const album = createDefaultAlbum('Concurrent Test', ['/path']);
      const apiError = createApiError(400, API_ERROR_CODES.VALIDATION_ERROR, 'Concurrent test');

      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate concurrent parsing
      const promises = Array.from({ length: 100 }, () => 
        Promise.all([
          Promise.resolve(uiStateSchema.parse(uiState)),
          Promise.resolve(smartAlbumSchema.parse(album)),
          Promise.resolve(apiErrorSchema.parse(apiError)),
        ])
      );

      return Promise.all(promises).then(() => {
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable for concurrent operations
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
        // Performance benchmark: Concurrent memory usage
      });
    });
  });

  describe('Validation Performance', () => {
    it('should validate invalid data efficiently', () => {
      const invalidData = [
        { version: 'invalid', selection: {}, filter: {}, layout: {}, preferences: {} },
        { version: 1, selection: 'invalid', filter: {}, layout: {}, preferences: {} },
        { version: 1, selection: {}, filter: {}, layout: { activeView: 'invalid' }, preferences: {} },
      ];

      const startTime = performance.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        invalidData.forEach(data => {
          try {
            uiStateSchema.parse(data);
          } catch {
            // Expected to throw
          }
        });
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / (iterations * invalidData.length);

      // Should reject invalid data quickly (less than 1ms per validation)
      expect(avgTime).toBeLessThan(1);
      // Performance benchmark: Invalid data validation
    });

    it('should handle mixed valid/invalid data efficiently', () => {
      const validUiState = createDefaultUiState();
      const validAlbum = createDefaultAlbum('Valid Album', ['/path']);
      const validError = createApiError(400, API_ERROR_CODES.VALIDATION_ERROR, 'Valid error');

      const invalidData = [
        { version: 'invalid', selection: {}, filter: {}, layout: {}, preferences: {} },
        { version: 1, name: '', sources: [], filter: null },
        { status: 'invalid', code: 'ERROR', message: 'Test' },
      ];

      const startTime = performance.now();
      const iterations = 500;

      for (let i = 0; i < iterations; i++) {
        // Parse valid data
        uiStateSchema.parse(validUiState);
        smartAlbumSchema.parse(validAlbum);
        apiErrorSchema.parse(validError);

        // Try to parse invalid data (should throw)
        try {
          uiStateSchema.parse(invalidData[0]);
        } catch {
          // Expected
        }

        try {
          smartAlbumSchema.parse(invalidData[1]);
        } catch {
          // Expected
        }

        try {
          apiErrorSchema.parse(invalidData[2]);
        } catch {
          // Expected
        }
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / (iterations * 6); // 3 valid + 3 invalid per iteration

      // Should handle mixed data efficiently
      expect(avgTime).toBeLessThan(1);
      // Performance benchmark: Mixed data validation
    });
  });
});
