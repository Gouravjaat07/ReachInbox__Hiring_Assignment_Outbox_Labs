import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    await prisma.sender.findMany({ take: 1 });
}
main()
    .catch((error) => {
    console.error('Prisma seed failed', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
