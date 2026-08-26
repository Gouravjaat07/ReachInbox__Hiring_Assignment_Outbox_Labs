import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, transaction, updateMany } = vi.hoisted(() => ({ findMany: vi.fn(), transaction: vi.fn(), updateMany: vi.fn() }));

vi.mock('../src/config/database.js', () => ({
  prisma: {
    email: { findMany, updateMany },
    $transaction: transaction,
  },
}));

import { emailRepository } from '../src/repositories/email.repository.js';

describe('email retry state', () => {
  beforeEach(() => {
    updateMany.mockReset();
    transaction.mockReset();
    findMany.mockReset();
  });

  it('releases only a claimed email for a BullMQ retry', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await emailRepository.releaseForRetry('email-123');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'email-123', status: 'PROCESSING' },
      data: { status: 'SCHEDULED', processingStartedAt: null },
    });
  });

  it('recovers stale processing claims without exceeding maximum attempts', async () => {
    transaction.mockResolvedValue([{ count: 2 }, { count: 1 }]);
    const cutoff = new Date('2026-08-26T08:00:00.000Z');

    await emailRepository.recoverStaleProcessing(cutoff, 3);

    expect(transaction).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { status: 'PROCESSING', processingStartedAt: { lt: cutoff }, attempts: { lt: 3 } },
      data: { status: 'SCHEDULED', bullJobId: null, processingStartedAt: null },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { status: 'PROCESSING', processingStartedAt: { lt: cutoff }, attempts: { gte: 3 } },
      data: expect.objectContaining({ status: 'FAILED', errorMessage: 'Worker claim expired after maximum attempts' }),
    });
  });

  it('queries scheduled and processing emails together for visibility', async () => {
    findMany.mockResolvedValue([]);

    await emailRepository.listByUserAndStatuses('user-123', ['SCHEDULED', 'PROCESSING']);

    expect(findMany).toHaveBeenCalledWith({
      where: { status: { in: ['SCHEDULED', 'PROCESSING'] }, campaign: { userId: 'user-123' } },
      orderBy: { scheduledAt: 'asc' },
      include: { sender: true, campaign: true },
    });
  });
});
