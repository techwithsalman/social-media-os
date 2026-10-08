import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { decryptToken } from '@/lib/crypto';
import { buildMetaGraphUrl } from '@/lib/meta-token-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const accountId = req.nextUrl.searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        workspaceId: session.workspaceId,
        platform: 'INSTAGRAM'
      },
      include: { token: true }
    });

    if (!account || !account.token || (!account.token.accessToken && !account.token.autoDmAccessToken)) {
      return NextResponse.json({ error: 'Invalid or disconnected account' }, { status: 400 });
    }

    let url = '';
    
    if (account.token.autoDmAccessToken) {
      // Use Instagram Login Token
      const token = decryptToken(account.token.autoDmAccessToken);
      url = `https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&limit=24&access_token=${encodeURIComponent(token)}`;
    } else if (account.token.accessToken) {
      // Fallback to Publishing Token
      const token = decryptToken(account.token.accessToken);
      const igUserId = account.platformAccountId;
      url = buildMetaGraphUrl(`/${igUserId}/media?fields=id,media_type,media_url,thumbnail_url,caption,timestamp&limit=24&access_token=${encodeURIComponent(token)}`);
    } else {
      return NextResponse.json({ error: 'No valid token found' }, { status: 400 });
    }

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ 
        error: data?.error?.message || 'Failed to fetch media from Meta API',
        code: data?.error?.code
      }, { status: res.status });
    }

    return NextResponse.json({ media: data.data || [] });
  } catch (error: any) {
    console.error('[IG Media Fetch Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
