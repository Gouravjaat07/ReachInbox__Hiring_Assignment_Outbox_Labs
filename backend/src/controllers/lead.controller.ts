import type { Request, Response } from 'express';
import { extractEmailsFromText } from '../utils/email-parser.js';
import { sendError, sendSuccess } from '../utils/response.js';

export async function parseLeads(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const file = req.file;
  const textBody = typeof req.body?.text === 'string' ? req.body.text : '';

  if (!file && !textBody) {
    return sendError(res, 'VALIDATION_ERROR', 'Provide a CSV/TXT file or text payload', 400);
  }

  let raw = textBody;
  if (file) {
    const allowed = ['text/plain', 'text/csv', 'application/vnd.ms-excel'];
    const extension = file.originalname.toLowerCase();
    if (!allowed.includes(file.mimetype) && !extension.endsWith('.txt') && !extension.endsWith('.csv')) {
      return sendError(res, 'UNSUPPORTED_FILE_TYPE', 'Only CSV and TXT files are supported', 400);
    }
    raw = file.buffer.toString('utf8');
  }

  const parsed = extractEmailsFromText(raw);
  return sendSuccess(res, parsed);
}
