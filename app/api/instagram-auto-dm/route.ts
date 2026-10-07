import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rules = await prisma.instagramAutoDmRule.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        socialAccount: { select: { name: true, username: true } },
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also fetch basic stats for the dashboard
    const totalSent = await prisma.instagramAutoDmExecution.count({
      where: { workspaceId: session.workspaceId, status: 'SENT' },
    });
    
    const totalFailed = await prisma.instagramAutoDmExecution.count({
      where: { workspaceId: session.workspaceId, status: 'FAILED' },
    });

    return NextResponse.json({
      rules,
      stats: {
        totalRules: rules.length,
        activeRules: rules.filter(r => r.enabled).length,
        totalSent,
        totalFailed,
      }
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, socialAccountId, mediaId, keyword, matchType, message, buttonLabel, destinationUrl, enabled } = body;

    if (!name || !socialAccountId || !keyword || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify social account belongs to workspace
    const account = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, workspaceId: session.workspaceId, platform: 'INSTAGRAM' }
    });

    console.log('[DEBUG CREATE RULE] checking account', { socialAccountId, workspaceId: session.workspaceId });
    if (!account) {
      return NextResponse.json({ error: 'Invalid social account' }, { status: 403 });
    }

    console.log('[DEBUG CREATE RULE] attempting to create in DB', { data: { workspaceId: session.workspaceId, socialAccountId, name, mediaId: mediaId || "ANY", keyword, matchType: matchType || 'EXACT', message, buttonLabel: buttonLabel || null, destinationUrl: destinationUrl || null, enabled: enabled ?? true } });
    const rule = await prisma.instagramAutoDmRule.create({
      data: {
        workspaceId: session.workspaceId,
        socialAccountId,
        name,
        mediaId: mediaId || "ANY",
        keyword,
        matchType: matchType || 'EXACT',
        message,
        buttonLabel: buttonLabel || null,
        destinationUrl: destinationUrl || null,
        enabled: enabled ?? true,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create rule', code: error?.code, details: error?.message || String(error) }, { status: 500 });
  }
}





