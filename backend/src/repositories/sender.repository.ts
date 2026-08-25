import { prisma } from '../config/database.js';

export const senderRepository = {
  listByUser(userId: string) {
    return prisma.sender.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { emails: true },
        },
      },
    });
  },
  findByIdForUser(senderId: string, userId: string) {
    return prisma.sender.findFirst({ where: { id: senderId, userId } });
  },
  create(userId: string, email: string, name: string) {
    return prisma.sender.create({ data: { userId, email, name } });
  },
};
