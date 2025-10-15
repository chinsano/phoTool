import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { AppError, ValidationError } from '../errors.js';
import { logger } from '../logger.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  void _next;

  // Handle AppError instances (including all subclasses)
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, context: err.context }, 'Unhandled error');
    } else {
      logger.warn({ err, context: err.context }, 'Handled error');
    }
    return res.status(err.status).json(err.toJSON());
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationError = new ValidationError('Validation failed', {
      issues: err.issues,
    });
    logger.warn({ err, issues: err.issues }, 'Validation error');
    return res.status(validationError.status).json(validationError.toJSON());
  }

  // Handle unknown errors
  const message = err instanceof Error ? err.message : 'Unexpected error';
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'internal_error',
      message,
      timestamp: new Date().toISOString(),
    },
  });
}


