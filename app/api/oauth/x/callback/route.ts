import { createOAuthCallbackResponse } from '@/lib/oauth-callback';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { consumeXOAuthState, exchangeXCodeForToken, XOAuthError } from '@/lib/x-oauth';
import { XAdapter } from '@/integrations/x';
import prisma from '@/lib/prisma';
import { encryptToken } from '@/lib/crypto';
import { assertCanConnectSocialAccount } from '@/lib/billing';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${origin}/accounts?x_error=${error}`);
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 });
    }

    const { redirectUri, codeVerifier } = await consumeXOAuthState(state, session);

    // Get the tokens using exchangeXCodeForToken which has the real implementation now
    const tokenData = await exchangeXCodeForToken(code, redirectUri, codeVerifier);

    // Call XAdapter to connect account using the code
    const xAdapter = new XAdapter();
    const connectResult = await xAdapter.connectAccount(code, redirectUri, codeVerifier, tokenData);

    const dbTokenData = {
      accessToken: encryptToken(connectResult.accessToken),
      refreshToken: connectResult.refreshToken ? encryptToken(connectResult.refreshToken) : null,
      scope: connectResult.scope || tokenData.scope,
      expiresAt: connectResult.expiresIn ? new Date(Date.now() + connectResult.expiresIn * 1000) : null,
    };

    const existing = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: session.workspaceId,
        platform: 'X',
        platformAccountId: connectResult.platformAccountId,
      },
    });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          name: connectResult.name,
          username: connectResult.username,
          profileImageUrl: connectResult.profileImageUrl,
          status: 'CONNECTED',
          isMock: false,
          token: {
            upsert: {
              create: dbTokenData,
              update: dbTokenData,
            },
          },
        },
      });
    } else {
      await assertCanConnectSocialAccount(session.workspaceId);

      await prisma.socialAccount.create({
        data: {
          workspaceId: session.workspaceId,
          platform: 'X',
          platformAccountId: connectResult.platformAccountId,
          name: connectResult.name,
          username: connectResult.username,
          profileImageUrl: connectResult.profileImageUrl,
          status: 'CONNECTED',
          isMock: false,
          token: {
            create: dbTokenData,
          },
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.userId,
        action: 'ACCOUNT_CONNECTED',
        details: `Connected official X account (@${connectResult.username}) via OAuth`,
      },
    });

    return NextResponse.redirect(`${origin}/accounts?x_connected=true`);
  } catch (error: any) {
    console.error('[X OAuth Callback Error]', error);
    let errorMessage = 'Failed to connect X account';
    if (error instanceof XOAuthError) {
      errorMessage = error.message;
    }
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/accounts?x_error=${encodeURIComponent(errorMessage)}`);
  }
}
