import type { Request, Response, NextFunction } from 'express';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type ZodError, z } from 'zod';

import {
  AppError,
  ValidationError,
  NotFoundError,
  InternalError,
  ExternalServiceError,
} from '../../src/errors.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('errorHandler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {};
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = vi.fn();
  });

  describe('AppError handling', () => {
    it('should handle ValidationError correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'validation_error',
            message: 'Invalid input',
            context: { field: 'email' },
          }),
        })
      );
    });

    it('should handle NotFoundError correctly', () => {
      const error = new NotFoundError('User not found', { userId: '123' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'not_found',
            message: 'User not found',
            context: { userId: '123' },
          }),
        })
      );
    });

    it('should handle InternalError correctly', () => {
      const error = new InternalError('Database error', { operation: 'query' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'internal_error',
            message: 'Database error',
            context: { operation: 'query' },
          }),
        })
      );
    });

    it('should handle ExternalServiceError correctly', () => {
      const error = new ExternalServiceError('API unavailable', {
        service: 'geocoder',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(502);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'external_service_error',
            message: 'API unavailable',
            context: { service: 'geocoder' },
          }),
        })
      );
    });

    it('should use toJSON() method for serialization', () => {
      const error = new ValidationError('Test error', { test: true });
      const expectedJSON = error.toJSON();

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(expectedJSON);
    });
  });

  describe('ZodError handling', () => {
    it('should convert ZodError to ValidationError', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      let zodError: ZodError;
      try {
        schema.parse({ email: 'invalid', age: 15 });
      } catch (err) {
        zodError = err as ZodError;
      }

      errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'validation_error',
            message: 'Validation failed',
            context: expect.objectContaining({
              issues: expect.any(Array),
            }),
          }),
        })
      );
    });

    it('should include Zod issues in context', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      let zodError: ZodError;
      try {
        schema.parse({ email: 'not-an-email' });
      } catch (err) {
        zodError = err as ZodError;
      }

      errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

      const callArg = jsonMock.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg.error.context.issues).toHaveLength(1);
      expect(callArg.error.context.issues[0]).toHaveProperty('path');
      expect(callArg.error.context.issues[0]).toHaveProperty('message');
    });
  });

  describe('Unknown error handling', () => {
    it('should handle standard Error instances', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'internal_error',
            message: 'Something went wrong',
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it('should handle non-Error objects', () => {
      const error = 'string error';

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'internal_error',
            message: 'Unexpected error',
          }),
        })
      );
    });

    it('should handle null/undefined errors', () => {
      errorHandler(null, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'internal_error',
            message: 'Unexpected error',
          }),
        })
      );
    });
  });

  describe('Error context preservation', () => {
    it('should preserve error context in AppError', () => {
      const context = {
        userId: '123',
        action: 'delete',
        resourceId: '456',
      };
      const error = new AppError('Action failed', 400, 'action_failed', context);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const callArg = jsonMock.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg.error.context).toEqual(context);
    });

    it('should not include context when not provided', () => {
      const error = new NotFoundError('Not found');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const callArg = jsonMock.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg.error).not.toHaveProperty('context');
    });
  });

  describe('Response structure', () => {
    it('should return consistent JSON structure for all error types', () => {
      const errors = [
        new ValidationError('Validation failed'),
        new NotFoundError('Not found'),
        new InternalError('Internal error'),
      ];

      errors.forEach((error) => {
        jsonMock.mockClear();
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        const response = jsonMock.mock.calls[0]?.[0];
        expect(response).toBeDefined();
        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('code');
        expect(response.error).toHaveProperty('message');
        expect(response.error).toHaveProperty('timestamp');
      });
    });
  });
});
