import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getPinterestBoards } from '@/lib/pinterest-oauth';
import { decryptToken } from '@/lib/crypto';
import { PinterestAdapter } from '@/integrations/pinterest';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    let whereClause: any = {
      workspaceId: session.workspaceId,
      platform: 'PINTEREST',
    };

    if (accountId) {
      whereClause.id = accountId;
    }

    const accounts = await prisma.socialAccount.findMany({
      where: whereClause,
      include: { token: true },
    });

    const allBoards = [];
    const adapter = new PinterestAdapter();

    for (const acc of accounts) {
      if (acc.token?.accessToken) {
        let accessToken = decryptToken(acc.token.accessToken);
        
        // Auto-refresh token if expired (simplified)
        if (acc.token.expiresAt && new Date() > acc.token.expiresAt && acc.token.refreshToken) {
          try {
            const refreshTokenStr = decryptToken(acc.token.refreshToken);
            const refreshRes = await adapter.refreshToken(refreshTokenStr);
            accessToken = refreshRes.accessToken;
            // update in DB...
            await prisma.oAuthToken.update({
              where: { id: acc.token.id },
              data: {
                 accessToken: require('@/lib/crypto').encryptToken(refreshRes.accessToken),
                 expiresAt: refreshRes.expiresIn ? new Date(Date.now() + refreshRes.expiresIn * 1000) : null
              }
            });
          } catch(e) {
            console.error('[Pinterest Boards] Token refresh failed', e);
            continue;
          }
        }

        const boards = await getPinterestBoards(accessToken);
        for (const b of boards) {
          allBoards.push({
             id: b.id,
             name: b.name,
             accountId: acc.id,
             accountName: acc.name
          });
        }
      }
    }

    return NextResponse.json({ boards: allBoards });
  } catch (error: any) {
    console.error('[Pinterest Boards Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch boards', message: error.message }, { status: 500 });
  }
}
