const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const post = await prisma.contentPost.findFirst({
    where: { masterCaption: { contains: 'Test 05' } },
    include: { platformPosts: true }
  });
  console.log(JSON.stringify(post, null, 2));
}
main();
