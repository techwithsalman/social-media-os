import { NextResponse } from 'next/server';
import prisma from './prisma';
import { getSession, SessionPayload } from './auth';
import { isOwnerEmail } from './owner';

export class AdminAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAccessError';
    this.status = status;
  }
}

export async function requireSuperAdmin(sessionOverride?: SessionPayload | null) {
  const session = sessionOverride || (await getSession());
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

  // Strict: Only the canonical verified owner has Super Admin authority.
  // Mere database role assignment is not sufficient to gain Super Admin privileges.
  if (!isOwnerEmail(user.email)) {
    throw new AdminAccessError('Forbidden: Only the verified owner has Super Admin access.', 403);
  }

  // Ensure owner always has systemRole === 'SUPER_ADMIN'
  if (user.systemRole !== 'SUPER_ADMIN') {
    await prisma.user.update({
      where: { id: user.id },
      data: { systemRole: 'SUPER_ADMIN' },
    }).catch(() => {});
    user.systemRole = 'SUPER_ADMIN';
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
