const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const post = await prisma.contentPost.findFirst({
    where: { status: 'SCHEDULED' },
    orderBy: { createdAt: 'desc' }
  });
  console.log(post);
  console.log('Now UTC:', new Date().toISOString());
  if (post && post.scheduledFor) {
    console.log('Due check:', post.scheduledFor <= new Date());
  }
}
main().finally(() => prisma.$disconnect());
