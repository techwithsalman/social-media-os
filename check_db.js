const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='OAuthToken' AND column_name='autoDmAccessToken';
    `;

    if (result.length > 0) {
        console.log('EXISTS');
    } else {
        console.log('MISSING');
        await prisma.$executeRawUnsafe(`ALTER TABLE "OAuthToken" ADD COLUMN "autoDmAccessToken" TEXT;`);
        console.log('MIGRATED');
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
