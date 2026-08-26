import { describe, expect, it } from 'vitest';
import { isRetryableSmtpError } from '../src/services/mail.service.js';

describe('SMTP error classification', () => {
  it.each(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE', 'ESOCKET'])('retries %s', (code) => {
    const error = Object.assign(new Error('connection failed'), { code });
    expect(isRetryableSmtpError(error)).toBe(true);
  });

  it('retries transient 4xx SMTP responses', () => {
    const error = Object.assign(new Error('temporary failure'), { responseCode: 421 });
    expect(isRetryableSmtpError(error)).toBe(true);
  });

  it('does not retry authentication failures', () => {
    const error = Object.assign(new Error('authentication failed'), { responseCode: 535, code: 'EAUTH' });
    expect(isRetryableSmtpError(error)).toBe(false);
  });
});