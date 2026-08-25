import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  void _next;
  logger.error({ error }, 'Unhandled error');

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues.map((issue) => issue.message).join(', '),
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'Something went wrong' : error instanceof Error ? error.message : 'Something went wrong',
    },
  });
}
