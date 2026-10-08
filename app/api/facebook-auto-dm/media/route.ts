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
        platform: 'FACEBOOK'
      },
      include: { token: true }
    });

    if (!account || !account.token || !account.token.accessToken) {
      return NextResponse.json({ error: 'Invalid or disconnected account' }, { status: 400 });
    }

    const token = decryptToken(account.token.accessToken);
    const pageId = account.platformAccountId;
    
    // Fetch Page posts
    const url = buildMetaGraphUrl(`/${pageId}/posts?fields=id,message,created_time,full_picture,attachments{media_type,url,media}&limit=24&access_token=${encodeURIComponent(token)}`);

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ 
        error: data?.error?.message || 'Failed to fetch media from Meta API',
        code: data?.error?.code
      }, { status: res.status });
    }

    // Map Facebook post response to a generic media object shape for the UI
    const media = (data.data || []).map((post: any) => {
      let mediaType = 'IMAGE';
      let mediaUrl = post.full_picture || '';
      
      // Try to determine if it's a video from attachments
      if (post.attachments && post.attachments.data && post.attachments.data.length > 0) {
        const attachment = post.attachments.data[0];
        if (attachment.media_type === 'video') {
          mediaType = 'VIDEO';
        }
      }

      return {
        id: post.id,
        caption: post.message || '',
        media_type: mediaType,
        media_url: mediaUrl,
        thumbnail_url: mediaUrl,
        timestamp: post.created_time
      };
    });

    return NextResponse.json({ media });
  } catch (error: any) {
    console.error('[FB Media Fetch Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
