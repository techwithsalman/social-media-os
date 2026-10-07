import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rules = await prisma.facebookAutoDmRule.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        socialAccount: { select: { name: true, username: true } },
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalSent = await prisma.facebookAutoDmExecution.count({
      where: { workspaceId: session.workspaceId, status: 'SENT' },
    });
    
    const totalFailed = await prisma.facebookAutoDmExecution.count({
      where: { workspaceId: session.workspaceId, status: 'FAILED' },
    });

    const activeRules = rules.filter(r => r.enabled).length;

    return NextResponse.json({
      rules,
      stats: {
        activeRules,
        totalRules: rules.length,
        totalSent,
        totalFailed,
      }
    });
  } catch (error) {
    console.error('Failed to fetch Facebook auto DM rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, socialAccountId, postId, keyword, matchType, message } = body;

    if (!name || !socialAccountId || !keyword || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const socialAccount = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, workspaceId: session.workspaceId, platform: 'FACEBOOK' },
    });

    if (!socialAccount) {
      return NextResponse.json({ error: 'Facebook account not found or unauthorized' }, { status: 404 });
    }

    const rule = await prisma.facebookAutoDmRule.create({
      data: {
        workspaceId: session.workspaceId,
        socialAccountId,
        pageId: socialAccount.platformAccountId,
        postId: postId || 'ANY',
        name,
        keyword,
        matchType: matchType || 'EXACT',
        message,
        enabled: true,
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Failed to create Facebook auto DM rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, enabled } = body;

    if (!id) return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 });

    const rule = await prisma.facebookAutoDmRule.updateMany({
      where: { id, workspaceId: session.workspaceId },
      data: { enabled },
    });

    return NextResponse.json({ success: true, count: rule.count });
  } catch (error) {
    console.error('Failed to update Facebook auto DM rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 });

    const rule = await prisma.facebookAutoDmRule.deleteMany({
      where: { id, workspaceId: session.workspaceId },
    });

    return NextResponse.json({ success: true, count: rule.count });
  } catch (error) {
    console.error('Failed to delete Facebook auto DM rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

