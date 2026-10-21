import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { signSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { WORKSPACE_TIMEZONE } from '@/lib/timezone';
import { ensureDefaultPlans, getPlanByCode } from '@/lib/billing';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const rawAppUrl = process.env.NODE_ENV === "production"
    ? (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.techwithsalman.online")
    : "http://localhost:3000";
  const appUrl = rawAppUrl.replace(/\/+$/, "");

  if (error || !code) {
    return NextResponse.redirect(new URL('/login?error=google_auth_failed', appUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/login?error=google_config_missing', appUrl));
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[Google OAuth Token Error]', tokenData.error || tokenResponse.status);
      throw new Error('Failed to fetch tokens');
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await userInfoResponse.json();
    if (!userInfoResponse.ok || !userInfo?.email) {
      console.error('[Google OAuth UserInfo Error]', userInfoResponse.status);
      throw new Error('Failed to fetch user info');
    }

    const email = String(userInfo.email).toLowerCase().trim();

    let user = await prisma.user.findUnique({
      where: { email },
      include: { workspaces: true },
    });

    if (!user) {
      // Auto-register via Google
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: '', // no password for Google users
          firstName: userInfo.given_name || 'Google',
          lastName: userInfo.family_name || 'User',
          avatarUrl: userInfo.picture || null,
          lastActiveAt: new Date(),
        },
        include: { workspaces: true }
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          ...(!user.avatarUrl && userInfo.picture ? { avatarUrl: userInfo.picture } : {}),
        },
      });
    }

    // Ensure user has at least one workspace (covers both new users and existing users missing a workspace)
    if (!user.workspaces || user.workspaces.length === 0) {
      await ensureDefaultPlans();
      const freePlan = await getPlanByCode('FREE');

      const slugPrefix = user.firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
      const workspaceSlug = `${slugPrefix}-workspace-${Math.random()
        .toString(36)
        .substring(2, 6)}`;

      const workspace = await prisma.workspace.create({
        data: {
          name: `${user.firstName}'s Workspace`,
          slug: workspaceSlug,
          timezone: WORKSPACE_TIMEZONE,
          plan: 'FREE',
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });

      await prisma.notification.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          title: 'Welcome to Social Media OS!',
          message: 'Get started by connecting your social accounts.',
          type: 'SUCCESS',
          link: '/accounts',
        },
      });

      await prisma.subscription.create({
        data: {
          workspaceId: workspace.id,
          planId: freePlan.id,
          planTier: freePlan.code,
          status: 'ACTIVE',
          source: 'MANUAL',
          startedAt: new Date(),
          currentPeriodStart: new Date(),
        },
      });

      user.workspaces = [{ workspaceId: workspace.id, userId: user.id, role: 'OWNER', joinedAt: new Date() } as any];
    }

    const workspaceId = user.workspaces[0]?.workspaceId;

    if (!workspaceId) {
      throw new Error('No workspace found for user');
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      workspaceId: workspaceId,
    });

    const response = NextResponse.redirect(new URL('/dashboard', appUrl));

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('Google Auth Callback Error:', error instanceof Error ? error.message : 'Unknown error');
    const errRes = NextResponse.redirect(new URL('/login?error=google_auth_error', appUrl));
    errRes.cookies.delete(AUTH_COOKIE_NAME);
    return errRes;
  }
}
