import { describe, expect, it } from 'vitest';
import { extractEmailsFromText } from '../src/utils/email-parser.js';

describe('extractEmailsFromText', () => {
  it('extracts valid unique emails and counts invalid input', () => {
    const result = extractEmailsFromText('Alice <alice@example.com>, BOB@example.com, alice@example.com, bad-email');

    expect(result.emails).toEqual(['alice@example.com', 'bob@example.com']);
    expect(result.count).toBe(2);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.invalidCount).toBe(1);
  });
});