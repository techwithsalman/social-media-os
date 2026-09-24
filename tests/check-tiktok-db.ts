import prisma from '../src/lib/prisma';

async function main() {
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: 'TIKTOK' },
    include: { token: true }
  });
  console.log('TIKTOK ACCOUNTS IN DB:');
  for (const a of accounts) {
    console.log({
      id: a.id,
      workspaceId: a.workspaceId,
      name: a.name,
      username: a.username,
      platformAccountId: a.platformAccountId,
      status: a.status,
      isMock: a.isMock,
      hasToken: Boolean(a.token),
      tokenScope: a.token?.scope,
      tokenExpiresAt: a.token?.expiresAt,
    });
  }

  const states = await prisma.tikTokOAuthState.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('\nRECENT TIKTOK OAUTH STATES:');
  for (const s of states) {
    console.log({
      id: s.id,
      stateHashPrefix: s.stateHash.slice(0, 8) + '...',
      redirectUri: s.redirectUri,
      createdAt: s.createdAt,
      consumedAt: s.consumedAt,
      expiresAt: s.expiresAt,
      hasVerifier: Boolean(s.codeVerifier),
    });
  }
}

main().finally(() => prisma.$disconnect());
