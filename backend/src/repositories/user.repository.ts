import { prisma } from '../config/database.js';

export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  findByGoogleId(googleId: string) {
    return prisma.user.findUnique({ where: { googleId } });
  },
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  upsertGoogleUser(input: { googleId: string; email: string; name: string; avatar?: string | null }) {
    return prisma.user.upsert({
      where: { googleId: input.googleId },
      update: {
        email: input.email,
        name: input.name,
        avatar: input.avatar ?? null,
      },
      create: {
        googleId: input.googleId,
        email: input.email,
        name: input.name,
        avatar: input.avatar ?? null,
      },
    });
  },
};
