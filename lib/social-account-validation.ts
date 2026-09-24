import prisma from './prisma';

export async function validateWorkspacePostTargets(
  workspaceId: string,
  platformSettings: any[]
) {
  const accountIds = platformSettings
    .map((setting) => setting?.socialAccountId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (accountIds.length === 0) {
    return [];
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      workspaceId,
      id: { in: accountIds },
      status: 'CONNECTED',
    },
    select: {
      id: true,
      platform: true,
    },
  });

  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  if (accountsById.size !== accountIds.length) {
    throw new Error('One or more selected accounts are unavailable or need reconnection.');
  }

  return platformSettings.map((setting) => {
    const account = accountsById.get(setting.socialAccountId);
    return {
      ...setting,
      platform: account?.platform || setting.platform,
    };
  });
}
