import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function getResolvedDatabaseUrl(): { dbUrl: string; absolutePath: string } {
  const envUrl = process.env.DATABASE_URL || '';
  const rawPath = envUrl.startsWith('file:') ? envUrl.replace(/^file:/, '') : envUrl;

  let normalizedPath = rawPath.replace(/\\/g, '/');
  if (!normalizedPath || normalizedPath === './dev.db' || normalizedPath === 'dev.db') {
    normalizedPath = `${process.cwd().replace(/\\/g, '/')}/prisma/dev.db`;
  }

  const dbUrl = normalizedPath.startsWith('file:') ? normalizedPath : `file:${normalizedPath}`;
  return { dbUrl, absolutePath: normalizedPath };
}

const { dbUrl, absolutePath: dbPath } = getResolvedDatabaseUrl();

if (process.env.NEXT_RUNTIME !== 'edge') {
  console.log(`[DATABASE DIAGNOSTIC] Absolute Database Path: ${dbPath}`);
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

if (process.env.NEXT_RUNTIME !== 'edge') {
  prisma.socialAccount
    .findFirst({
      where: { platform: 'TIKTOK', status: 'CONNECTED' },
    })
    .then((acc) => {
      console.log(`[DATABASE DIAGNOSTIC] TikTok SocialAccount Found: ${Boolean(acc)}`);
      if (acc) {
        console.log(`[DATABASE DIAGNOSTIC] TikTok User: @${acc.username} (${acc.name})`);
      }
    })
    .catch(() => {
      console.log('[DATABASE DIAGNOSTIC] TikTok SocialAccount Found: false');
    });
}

export default prisma;


