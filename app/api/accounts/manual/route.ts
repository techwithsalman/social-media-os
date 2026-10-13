import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getWorkspaceEntitlements } from '@/lib/billing';

function sanitizeAndValidateFacebookProfile(input: string): {
  canonicalUrl: string;
  cleanUsername: string;
  platformAccountId: string;
} {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    throw new Error('Facebook profile URL or username is required.');
  }

  // Check if it's a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new Error('Invalid URL format. Please enter a valid Facebook profile URL.');
    }

    const validHosts = [
      'facebook.com',
      'www.facebook.com',
      'm.facebook.com',
      'web.facebook.com',
      'fb.com',
      'www.fb.com',
    ];

    const host = parsedUrl.hostname.toLowerCase();
    if (!validHosts.includes(host)) {
      throw new Error(
        'Invalid domain. The profile URL must point to Facebook (e.g., https://www.facebook.com/yourname).'
      );
    }

    // Extract path or profile id
    const pathname = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');
    const profileIdParam = parsedUrl.searchParams.get('id');

    if (profileIdParam) {
      // e.g. https://facebook.com/profile.php?id=1000123456789
      const cleanUsername = `user_${profileIdParam}`;
      const canonicalUrl = `https://www.facebook.com/profile.php?id=${encodeURIComponent(profileIdParam)}`;
      return {
        canonicalUrl,
        cleanUsername,
        platformAccountId: `id_${profileIdParam}`,
      };
    }

    if (!pathname) {
      throw new Error('Please provide your specific Facebook profile path or username.');
    }

    const cleanUsername = pathname.split('/')[0].replace(/[^a-zA-Z0-9._-]/g, '');
    if (!cleanUsername) {
      throw new Error('Could not identify a valid username or profile path from URL.');
    }

    const canonicalUrl = `https://www.facebook.com/${cleanUsername}`;
    return {
      canonicalUrl,
      cleanUsername,
      platformAccountId: cleanUsername.toLowerCase(),
    };
  }

  // Plain handle or username provided (e.g. @salman or salman.editz)
  const cleanUsername = trimmed.replace(/^@+/, '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (cleanUsername.length < 2) {
    throw new Error('Username must be at least 2 characters long.');
  }

  const canonicalUrl = `https://www.facebook.com/${cleanUsername}`;
  return {
    canonicalUrl,
    cleanUsername,
    platformAccountId: cleanUsername.toLowerCase(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, profileUrl } = body;

    const trimmedName = (name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json(
        { error: 'Profile Name is required (minimum 2 characters).' },
        { status: 400 }
      );
    }

    if (trimmedName.length > 100) {
      return NextResponse.json(
        { error: 'Profile Name must not exceed 100 characters.' },
        { status: 400 }
      );
    }

    let parsedProfile;
    try {
      parsedProfile = sanitizeAndValidateFacebookProfile(profileUrl);
    } catch (valErr: any) {
      return NextResponse.json(
        { error: valErr.message || 'Invalid Facebook profile information.' },
        { status: 400 }
      );
    }

    // Check for duplicate manual account within this workspace
    const existing = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: session.workspaceId,
        platform: 'FACEBOOK_PROFILE',
        platformAccountId: parsedProfile.platformAccountId,
      },
    });

    if (existing) {
      // Update existing record safely in-place without duplicating
      const updated = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          name: trimmedName,
          username: parsedProfile.cleanUsername,
          status: 'CONNECTED',
          isMock: false,
        },
      });

      return NextResponse.json({
        success: true,
        account: updated,
        message: 'Existing Facebook Personal Profile updated successfully.',
      });
    }

    // Enforce workspace social account plan limits
    const entitlements = await getWorkspaceEntitlements(session.workspaceId);
    if (
      entitlements.limits.maxSocialAccounts !== null &&
      entitlements.usage.connectedAccounts >= entitlements.limits.maxSocialAccounts
    ) {
      return NextResponse.json(
        {
          error: 'PLAN_LIMIT_REACHED',
          message: `Your ${entitlements.plan.name} plan allows up to ${entitlements.limits.maxSocialAccounts} connected accounts. Please upgrade to connect more.`,
        },
        { status: 403 }
      );
    }

    // Create the manual account
    const account = await prisma.socialAccount.create({
      data: {
        workspaceId: session.workspaceId,
        platform: 'FACEBOOK_PROFILE',
        platformAccountId: parsedProfile.platformAccountId,
        name: trimmedName,
        username: parsedProfile.cleanUsername,
        status: 'CONNECTED',
        isMock: false,
      },
    });

    // Record activity audit log
    await prisma.activityLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.userId,
        action: 'SOCIAL_ACCOUNT_CONNECTED',
        details: `Connected Facebook Personal Profile (Manual): ${trimmedName} (@${parsedProfile.cleanUsername})`,
      },
    });

    return NextResponse.json({
      success: true,
      account,
      message: 'Facebook Personal Profile (Manual) connected successfully.',
    });
  } catch (error: any) {
    console.error('[Manual Facebook Profile Connect Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect Facebook Personal Profile.' },
      { status: 500 }
    );
  }
}
