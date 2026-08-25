import type { EmailStatus } from '@prisma/client';
import { emailRepository } from '../repositories/email.repository.js';

export const emailService = {
  listByStatus(userId: string, status: EmailStatus) {
    return emailRepository.listByUserAndStatus(userId, status);
  },
  getById(userId: string, emailId: string) {
    return emailRepository.findByIdForUser(emailId, userId);
  },
};
