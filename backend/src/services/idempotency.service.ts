import { prisma } from '../config/database.js';

export async function claimEmailForProcessing(emailId: string) {
  const claimed = await prisma.email.updateMany({
    where: { id: emailId, status: 'SCHEDULED' },
    data: {
      status: 'PROCESSING',
      processingStartedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  return prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true, campaign: true },
  });
}

export async function finalizeSentEmail(emailId: string, previewUrl?: string | null) {
  return prisma.email.updateMany({
    where: { id: emailId, status: 'PROCESSING' },
    data: { status: 'SENT', sentAt: new Date(), errorMessage: null, failedAt: null, ...(previewUrl ? { previewUrl } : {}) },
  });
}

export async function finalizeFailedEmail(emailId: string, errorMessage: string) {
  return prisma.email.updateMany({
    where: { id: emailId, status: 'PROCESSING' },
    data: { status: 'FAILED', failedAt: new Date(), errorMessage },
  });
}
