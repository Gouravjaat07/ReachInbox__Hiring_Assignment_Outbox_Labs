import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));

vi.mock('../src/config/database.js', () => ({
  prisma: {
    email: { updateMany },
  },
}));

import { emailRepository } from '../src/repositories/email.repository.js';

describe('email retry state', () => {
  beforeEach(() => {
    updateMany.mockReset();
  });

  it('releases only a claimed email for a BullMQ retry', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await emailRepository.releaseForRetry('email-123');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'email-123', status: 'PROCESSING' },
      data: { status: 'SCHEDULED', processingStartedAt: null },
    });
  });
});
