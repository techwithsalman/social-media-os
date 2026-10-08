const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const posts = await prisma.contentPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(posts.map(p => ({ id: p.id, status: p.status, scheduledFor: p.scheduledFor })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
