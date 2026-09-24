const { PrismaClient } = require('./node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

async function testDb(dbPath) {
  console.log('\n--- Testing DB at:', dbPath, '---');
  if (!fs.existsSync(dbPath)) {
    console.log('File does NOT exist at path!');
    return;
  }
  const stat = fs.statSync(dbPath);
  console.log('File Size:', stat.size, 'bytes | Last Modified:', stat.mtime);
  
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`
        }
      }
    });
    
    const accounts = await prisma.socialAccount.findMany({
      include: { token: true }
    });
    
    console.log('Total Social Accounts:', accounts.length);
    for (const acc of accounts) {
      console.log(`  - [${acc.platform}] ${acc.name} (@${acc.username}) | Status: ${acc.status} | isMock: ${acc.isMock}`);
    }
    await prisma.$disconnect();
  } catch (err) {
    console.error('Failed to query DB at', dbPath, err.message);
  }
}

async function main() {
  const appDataPath = process.env.APPDATA ? path.join(process.env.APPDATA, 'Social Media OS', 'dev.db') : '';
  const localDataPath = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Social Media OS', 'dev.db') : '';
  const projectPrismaDb = path.join(__dirname, 'prisma', 'dev.db');
  const projectRootDb = path.join(__dirname, 'dev.db');
  
  await testDb(projectPrismaDb);
  await testDb(projectRootDb);
  if (appDataPath) await testDb(appDataPath);
  if (localDataPath) await testDb(localDataPath);
}

main();
