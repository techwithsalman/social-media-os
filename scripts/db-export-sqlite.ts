import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';

export interface DatabaseDump {
  version: string;
  exportedAt: string;
  source: string;
  counts: Record<string, number>;
  tables: {
    plans: any[];
    users: any[];
    workspaces: any[];
    workspaceMembers: any[];
    socialAccounts: any[];
    oauthTokens: any[];
    metaOAuthStates: any[];
    metaOAuthSelections: any[];
    tikTokOAuthStates: any[];
    mediaAssets: any[];
    contentPosts: any[];
    platformPosts: any[];
    publishingJobs: any[];
    publishingAttempts: any[];
    notifications: any[];
    activityLogs: any[];
    subscriptions: any[];
    planOverrides: any[];
    usagePeriods: any[];
    usageCredits: any[];
    paymentTransactions: any[];
  };
}

export async function exportSqliteDatabase(outputFilePath?: string): Promise<DatabaseDump> {
  console.log('--- Starting SQLite Database Export ---');

  // Fetch all tables
  const plans = await prisma.plan.findMany();
  const users = await prisma.user.findMany();
  const workspaces = await prisma.workspace.findMany();
  const workspaceMembers = await prisma.workspaceMember.findMany();
  const socialAccounts = await prisma.socialAccount.findMany();
  const oauthTokens = await prisma.oAuthToken.findMany();
  const metaOAuthStates = await prisma.metaOAuthState.findMany();
  const metaOAuthSelections = await prisma.metaOAuthSelection.findMany();
  const tikTokOAuthStates = await prisma.tikTokOAuthState.findMany();
  const mediaAssets = await prisma.mediaAsset.findMany();
  const contentPosts = await prisma.contentPost.findMany();
  const platformPosts = await prisma.platformPost.findMany();
  const publishingJobs = await prisma.publishingJob.findMany();
  const publishingAttempts = await prisma.publishingAttempt.findMany();
  const notifications = await prisma.notification.findMany();
  const activityLogs = await prisma.activityLog.findMany();
  const subscriptions = await prisma.subscription.findMany();
  const planOverrides = await prisma.planOverride.findMany();
  const rawUsagePeriods = await prisma.usagePeriod.findMany();
  const usageCredits = await prisma.usageCredit.findMany();
  const paymentTransactions = await prisma.paymentTransaction.findMany();

  // Convert BigInt to string in UsagePeriod
  const usagePeriods = rawUsagePeriods.map((p) => ({
    ...p,
    uploadedBytes: p.uploadedBytes !== undefined ? p.uploadedBytes.toString() : '0',
  }));

  const counts: Record<string, number> = {
    plans: plans.length,
    users: users.length,
    workspaces: workspaces.length,
    workspaceMembers: workspaceMembers.length,
    socialAccounts: socialAccounts.length,
    oauthTokens: oauthTokens.length,
    metaOAuthStates: metaOAuthStates.length,
    metaOAuthSelections: metaOAuthSelections.length,
    tikTokOAuthStates: tikTokOAuthStates.length,
    mediaAssets: mediaAssets.length,
    contentPosts: contentPosts.length,
    platformPosts: platformPosts.length,
    publishingJobs: publishingJobs.length,
    publishingAttempts: publishingAttempts.length,
    notifications: notifications.length,
    activityLogs: activityLogs.length,
    subscriptions: subscriptions.length,
    planOverrides: planOverrides.length,
    usagePeriods: usagePeriods.length,
    usageCredits: usageCredits.length,
    paymentTransactions: paymentTransactions.length,
  };

  const dump: DatabaseDump = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    source: 'SQLite (prisma/dev.db)',
    counts,
    tables: {
      plans,
      users,
      workspaces,
      workspaceMembers,
      socialAccounts,
      oauthTokens,
      metaOAuthStates,
      metaOAuthSelections,
      tikTokOAuthStates,
      mediaAssets,
      contentPosts,
      platformPosts,
      publishingJobs,
      publishingAttempts,
      notifications,
      activityLogs,
      subscriptions,
      planOverrides,
      usagePeriods,
      usageCredits,
      paymentTransactions,
    },
  };

  const targetPath = outputFilePath || path.resolve(__dirname, '..', 'backups', 'sqlite-export.json');
  const backupDir = path.dirname(targetPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(dump, null, 2), 'utf-8');
  console.log(`✅ Successfully exported ${Object.values(counts).reduce((a, b) => a + b, 0)} total records across ${Object.keys(counts).length} tables.`);
  console.log(`📁 Backup saved to: ${targetPath}`);

  return dump;
}

if (require.main === module) {
  exportSqliteDatabase()
    .then((dump) => {
      console.log('\n--- Export Table Counts Summary ---');
      console.table(dump.counts);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Export failed:', err);
      process.exit(1);
    });
}
