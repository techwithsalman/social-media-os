import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function getResolvedDatabaseUrl(): { dbUrl: string; absolutePath: string } {
  const envUrl = (process.env.DATABASE_URL || process.env.POSTGRES_DATABASE_URL || '').trim();
  
  if (envUrl.startsWith('postgres://') || envUrl.startsWith('postgresql://')) {
    try {
      const parsed = new URL(envUrl);
      // Prisma v5 quaint engine does not support channel_binding=require
      parsed.searchParams.delete('channel_binding');
      // Ensure SSL is enforced on cloud PostgreSQL hosts (Aiven, Neon, etc.)
      if (!parsed.searchParams.has('sslmode') && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
        parsed.searchParams.set('sslmode', 'require');
      }
      // Ensure pgbouncer=true is enabled when connecting via a Neon -pooler endpoint
      if (parsed.hostname.includes('-pooler.') && !parsed.searchParams.has('pgbouncer')) {
        parsed.searchParams.set('pgbouncer', 'true');
      }
      // Enforce low connection limits per serverless instance for direct databases (e.g., Aiven Free 20 connection limit)
      if (!parsed.hostname.includes('-pooler.') && !parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set('connection_limit', '2');
      }
      // Allow sufficient time for serverless compute cold-starts and pool acquisition
      if (!parsed.searchParams.has('connect_timeout')) {
        parsed.searchParams.set('connect_timeout', '15');
      }
      if (!parsed.searchParams.has('pool_timeout')) {
        parsed.searchParams.set('pool_timeout', '15');
      }
      return { dbUrl: parsed.toString(), absolutePath: 'PostgreSQL Database' };
    } catch {
      return { dbUrl: envUrl, absolutePath: 'PostgreSQL Database' };
    }
  }

  const rawPath = envUrl.startsWith('file:') ? envUrl.replace(/^file:/, '') : envUrl;

  let normalizedPath = rawPath.replace(/\\/g, '/');
  if (!normalizedPath || normalizedPath === './dev.db' || normalizedPath === 'dev.db') {
    normalizedPath = `${process.cwd().replace(/\\/g, '/')}/prisma/dev.db`;
  }

  const dbUrl = normalizedPath.startsWith('file:') ? normalizedPath : `file:${normalizedPath}`;
  return { dbUrl, absolutePath: normalizedPath };
}

const { dbUrl } = getResolvedDatabaseUrl();

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

global.prisma = prisma;

export default prisma;


