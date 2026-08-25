import { z } from 'zod';

const emailRegex = z.string().email();
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function extractEmailsFromText(input: string) {
  const candidates = input.match(emailPattern) ?? [];

  const validEmails: string[] = [];
  const seen = new Set<string>();
  const invalidCount = Math.max(0, input.split(/[,;\n\r\t]+/).filter(Boolean).length - candidates.length);
  let duplicatesRemoved = 0;

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    const parsed = emailRegex.safeParse(normalized);
    if (!parsed.success) {
      continue;
    }
    if (seen.has(normalized)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(normalized);
    validEmails.push(normalized);
  }

  return {
    emails: validEmails,
    count: validEmails.length,
    invalidCount,
    duplicatesRemoved,
  };
}
