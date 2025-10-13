import type { Request, Response, NextFunction } from 'express';

import type { AppError } from '../errors.js';
import { logger } from '../logger.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  void _next;
  const appError = err as Partial<AppError>;
  const status = typeof appError.status === 'number' ? appError.status : 500;
  const code = typeof appError.code === 'string' ? appError.code : 'internal_error';
  const message = appError instanceof Error ? appError.message : 'Unexpected error';

  if (status >= 500) {
    logger.error({ err }, 'Unhandled error');
  } else {
    logger.warn({ err }, 'Handled error');
  }

  res.status(status).json({ error: { code, message } });
}


