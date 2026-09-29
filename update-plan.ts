import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.plan.updateMany({
    where: { code: 'FREE' },
    data: { maxSocialAccounts: 8 }
  });
  console.log('Done updating DB plan');
}
main().catch(console.error).finally(() => prisma.$disconnect());
