import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running dummy YouTube account cleanup...');

  try {
    const deleted = await prisma.socialAccount.deleteMany({
      where: {
        platform: 'YOUTUBE',
        isMock: true,
        OR: [
          { username: 'AlexRiveraOfficial' },
          { username: '@AlexRiveraOfficial' },
          { name: 'Alex Rivera Tech & Growth' }
        ]
      },
    });

    console.log(`Cleanup complete. Deleted ${deleted.count} dummy YouTube accounts.`);
  } catch (err) {
    console.error('Failed to cleanup dummy records:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
