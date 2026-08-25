import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { sendError } from '../utils/response.js';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'VALIDATION_ERROR', parsed.error.issues.map((issue) => issue.message).join(', '), 400);
    }

    req.body = parsed.data;
    return next();
  };
}
