import { NextResponse } from 'next/server';
import prisma from './prisma';
import { getSession } from './auth';

export class AdminAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAccessError';
    this.status = status;
  }
}

export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) {
    throw new AdminAccessError('Unauthorized', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      systemRole: true,
      status: true,
    },
  });

  if (!user) {
    throw new AdminAccessError('Unauthorized', 401);
  }

  if (user.systemRole !== 'SUPER_ADMIN') {
    throw new AdminAccessError('Forbidden', 403);
  }

  return { session, user };
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Admin request failed' },
    { status: 500 }
  );
}

export async function getPrimaryWorkspaceForUser(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  });

  return membership?.workspace || null;
}
