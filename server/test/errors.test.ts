import { describe, it, expect } from 'vitest';

import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalError,
  ExternalServiceError,
  createAppError,
} from '../src/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(500);
      expect(error.code).toBe('internal_error');
      expect(error.name).toBe('AppError');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.context).toBeUndefined();
    });

    it('should create error with custom values', () => {
      const context = { userId: '123', action: 'delete' };
      const error = new AppError('Custom error', 400, 'custom_code', context);

      expect(error.message).toBe('Custom error');
      expect(error.status).toBe(400);
      expect(error.code).toBe('custom_code');
      expect(error.context).toEqual(context);
    });

    it('should serialize to JSON correctly', () => {
      const context = { userId: '123' };
      const error = new AppError('Test error', 400, 'test_code', context);
      const json = error.toJSON();

      expect(json).toHaveProperty('error');
      expect(json.error).toHaveProperty('code', 'test_code');
      expect(json.error).toHaveProperty('message', 'Test error');
      expect(json.error).toHaveProperty('timestamp');
      expect(json.error).toHaveProperty('context', context);
    });

    it('should serialize without context when not provided', () => {
      const error = new AppError('Test error', 400, 'test_code');
      const json = error.toJSON();

      expect(json.error).not.toHaveProperty('context');
    });

    it('should have proper stack trace', () => {
      const error = new AppError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with correct defaults', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.status).toBe(400);
      expect(error.code).toBe('validation_error');
      expect(error.name).toBe('ValidationError');
    });

    it('should accept context', () => {
      const context = { field: 'email', reason: 'invalid format' };
      const error = new ValidationError('Validation failed', context);

      expect(error.context).toEqual(context);
    });

    it('should be instance of AppError', () => {
      const error = new ValidationError('Invalid input');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with correct defaults', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.message).toBe('Resource not found');
      expect(error.status).toBe(404);
      expect(error.code).toBe('not_found');
      expect(error.name).toBe('NotFoundError');
    });

    it('should accept context', () => {
      const context = { resourceType: 'user', id: '123' };
      const error = new NotFoundError('User not found', context);

      expect(error.context).toEqual(context);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with correct defaults', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.message).toBe('Resource already exists');
      expect(error.status).toBe(409);
      expect(error.code).toBe('conflict');
      expect(error.name).toBe('ConflictError');
    });

    it('should accept context', () => {
      const context = { field: 'email', value: 'test@example.com' };
      const error = new ConflictError('Email already exists', context);

      expect(error.context).toEqual(context);
    });
  });

  describe('InternalError', () => {
    it('should create internal error with correct defaults', () => {
      const error = new InternalError('Database connection failed');

      expect(error.message).toBe('Database connection failed');
      expect(error.status).toBe(500);
      expect(error.code).toBe('internal_error');
      expect(error.name).toBe('InternalError');
    });

    it('should accept context', () => {
      const context = { database: 'primary', operation: 'connect' };
      const error = new InternalError('Connection failed', context);

      expect(error.context).toEqual(context);
    });
  });

  describe('ExternalServiceError', () => {
    it('should create external service error with correct defaults', () => {
      const error = new ExternalServiceError('Geocoding service unavailable');

      expect(error.message).toBe('Geocoding service unavailable');
      expect(error.status).toBe(502);
      expect(error.code).toBe('external_service_error');
      expect(error.name).toBe('ExternalServiceError');
    });

    it('should accept context', () => {
      const context = { service: 'BigDataCloud', statusCode: 503 };
      const error = new ExternalServiceError('Service unavailable', context);

      expect(error.context).toEqual(context);
    });
  });

  describe('createAppError (legacy)', () => {
    it('should create AppError for backward compatibility', () => {
      const error = createAppError('test_code', 400, 'Test message');

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('test_code');
      expect(error.status).toBe(400);
      expect(error.message).toBe('Test message');
    });
  });
});
