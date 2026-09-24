import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { EntitlementError, assertCanInviteTeamMember } from '@/lib/billing';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch team' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, role, firstName = 'Team', lastName = 'Member' } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user exists, else create user placeholder
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash: 'pending_invitation',
          firstName,
          lastName,
        },
      });
    }

    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: session.workspaceId,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 });
    }

    await assertCanInviteTeamMember(session.workspaceId);

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId: session.workspaceId,
        userId: user.id,
        role: role || 'EDITOR',
      },
      include: {
        user: true,
      },
    });

    return NextResponse.json({ success: true, member });
  } catch (error: any) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Failed to invite team member' }, { status: 500 });
  }
}
