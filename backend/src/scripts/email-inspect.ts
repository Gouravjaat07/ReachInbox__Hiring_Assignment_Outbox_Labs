import { prisma } from '../config/database.js';

const emailId = process.argv[2];

if (!emailId) {
  console.error('Usage: npm run email:inspect -- <email-id>');
  process.exitCode = 1;
} else {
  try {
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        attempts: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        bullJobId: true,
        processingStartedAt: true,
        failedAt: true,
      },
    });
    console.log(JSON.stringify(email, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}