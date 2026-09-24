import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import type { DatabaseDump } from './db-export-sqlite';

export async function importPostgresDatabase(
  dumpFilePath?: string,
  targetPostgresUrl?: string
) {
  const filePath = dumpFilePath || path.resolve(__dirname, '..', 'backups', 'sqlite-export.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found at: ${filePath}. Run export script first.`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const dump: DatabaseDump = JSON.parse(raw);

  const connectionUrl = targetPostgresUrl || process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionUrl || connectionUrl.startsWith('file:')) {
    throw new Error('Target PostgreSQL DATABASE_URL is not set or points to SQLite.');
  }

  console.log(`--- Starting PostgreSQL Import from ${filePath} ---`);
  console.log(`Source exported at: ${dump.exportedAt}`);

  const prisma = new PrismaClient({
    datasources: {
      db: { url: connectionUrl },
    },
  });

  try {
    const { tables } = dump;

    // Level 0: Independent tables
    console.log('Importing Plans...');
    for (const item of tables.plans) {
      await prisma.plan.upsert({
        where: { id: item.id },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    console.log('Importing Users...');
    for (const item of tables.users) {
      await prisma.user.upsert({
        where: { id: item.id },
        create: {
          ...item,
          lastActiveAt: item.lastActiveAt ? new Date(item.lastActiveAt) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    console.log('Importing MetaOAuthStates & Selections...');
    for (const item of tables.metaOAuthStates) {
      await prisma.metaOAuthState.upsert({
        where: { stateHash: item.stateHash },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
          expiresAt: new Date(item.expiresAt),
          consumedAt: item.consumedAt ? new Date(item.consumedAt) : null,
        },
        update: {},
      });
    }

    for (const item of tables.metaOAuthSelections) {
      await prisma.metaOAuthSelection.upsert({
        where: { selectionTokenHash: item.selectionTokenHash },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
          expiresAt: new Date(item.expiresAt),
          consumedAt: item.consumedAt ? new Date(item.consumedAt) : null,
        },
        update: {},
      });
    }

    console.log('Importing TikTokOAuthStates...');
    for (const item of tables.tikTokOAuthStates) {
      await prisma.tikTokOAuthState.upsert({
        where: { stateHash: item.stateHash },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
          expiresAt: new Date(item.expiresAt),
          consumedAt: item.consumedAt ? new Date(item.consumedAt) : null,
        },
        update: {},
      });
    }

    // Level 1: Workspaces & Admin creations
    console.log('Importing Workspaces...');
    for (const item of tables.workspaces) {
      await prisma.workspace.upsert({
        where: { id: item.id },
        create: {
          ...item,
          suspendedAt: item.suspendedAt ? new Date(item.suspendedAt) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    console.log('Importing Plan Overrides...');
    for (const item of tables.planOverrides) {
      await prisma.planOverride.upsert({
        where: { id: item.id },
        create: {
          ...item,
          startsAt: new Date(item.startsAt),
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          revokedAt: item.revokedAt ? new Date(item.revokedAt) : null,
          createdAt: new Date(item.createdAt),
        },
        update: {},
      });
    }

    console.log('Importing Usage Credits & Payments...');
    for (const item of tables.usageCredits) {
      await prisma.usageCredit.upsert({
        where: { id: item.id },
        create: {
          ...item,
          startsAt: new Date(item.startsAt),
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          revokedAt: item.revokedAt ? new Date(item.revokedAt) : null,
          createdAt: new Date(item.createdAt),
        },
        update: {},
      });
    }

    for (const item of tables.paymentTransactions) {
      await prisma.paymentTransaction.upsert({
        where: { id: item.id },
        create: {
          ...item,
          paidAt: item.paidAt ? new Date(item.paidAt) : null,
          createdAt: new Date(item.createdAt),
        },
        update: {},
      });
    }

    // Level 2: Workspace Members, Social Accounts, Media Assets
    console.log('Importing Workspace Members...');
    for (const item of tables.workspaceMembers) {
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: item.workspaceId,
            userId: item.userId,
          },
        },
        create: {
          ...item,
          joinedAt: new Date(item.joinedAt),
        },
        update: {},
      });
    }

    console.log('Importing Subscriptions...');
    for (const item of tables.subscriptions) {
      await prisma.subscription.upsert({
        where: { id: item.id },
        create: {
          ...item,
          startedAt: new Date(item.startedAt),
          currentPeriodStart: item.currentPeriodStart ? new Date(item.currentPeriodStart) : null,
          currentPeriodEnd: item.currentPeriodEnd ? new Date(item.currentPeriodEnd) : null,
          trialEndsAt: item.trialEndsAt ? new Date(item.trialEndsAt) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    console.log('Importing Social Accounts...');
    for (const item of tables.socialAccounts) {
      await prisma.socialAccount.upsert({
        where: {
          workspaceId_platform_platformAccountId: {
            workspaceId: item.workspaceId,
            platform: item.platform,
            platformAccountId: item.platformAccountId,
          },
        },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    console.log('Importing Media Assets...');
    for (const item of tables.mediaAssets) {
      await prisma.mediaAsset.upsert({
        where: { id: item.id },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
        },
        update: {},
      });
    }

    console.log('Importing Activity Logs & Notifications...');
    for (const item of tables.activityLogs) {
      await prisma.activityLog.upsert({
        where: { id: item.id },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
        },
        update: {},
      });
    }

    for (const item of tables.notifications) {
      await prisma.notification.upsert({
        where: { id: item.id },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
        },
        update: {},
      });
    }

    for (const item of tables.usagePeriods) {
      await prisma.usagePeriod.upsert({
        where: {
          workspaceId_periodStart_periodEnd: {
            workspaceId: item.workspaceId,
            periodStart: new Date(item.periodStart),
            periodEnd: new Date(item.periodEnd),
          },
        },
        create: {
          ...item,
          periodStart: new Date(item.periodStart),
          periodEnd: new Date(item.periodEnd),
          uploadedBytes: BigInt(item.uploadedBytes || 0),
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    // Level 3: OAuth Tokens & Content Posts
    console.log('Importing OAuth Tokens...');
    for (const item of tables.oauthTokens) {
      await prisma.oAuthToken.upsert({
        where: { socialAccountId: item.socialAccountId },
        create: {
          ...item,
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    console.log('Importing Content Posts...');
    for (const item of tables.contentPosts) {
      await prisma.contentPost.upsert({
        where: { id: item.id },
        create: {
          ...item,
          scheduledFor: item.scheduledFor ? new Date(item.scheduledFor) : null,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    // Level 4: Platform Posts
    console.log('Importing Platform Posts...');
    for (const item of tables.platformPosts) {
      await prisma.platformPost.upsert({
        where: { id: item.id },
        create: {
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    // Level 5 & 6: Publishing Jobs & Attempts
    console.log('Importing Publishing Jobs...');
    for (const item of tables.publishingJobs) {
      await prisma.publishingJob.upsert({
        where: { id: item.id },
        create: {
          ...item,
          scheduledAt: new Date(item.scheduledAt),
          startedAt: item.startedAt ? new Date(item.startedAt) : null,
          completedAt: item.completedAt ? new Date(item.completedAt) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        update: {},
      });
    }

    console.log('Importing Publishing Attempts...');
    for (const item of tables.publishingAttempts) {
      await prisma.publishingAttempt.upsert({
        where: { id: item.id },
        create: {
          ...item,
          attemptedAt: new Date(item.attemptedAt),
        },
        update: {},
      });
    }

    console.log('✅ PostgreSQL database import completed successfully!');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  importPostgresDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Import failed:', err);
      process.exit(1);
    });
}
