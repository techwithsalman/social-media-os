import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from './prisma';
import { isOwnerEmail } from './owner';

const AUTH_SECRET = process.env.AUTH_SECRET || 'social-media-os-dev-super-secure-session-secret-key-32chars';
export const AUTH_COOKIE_NAME = 'smos_session_token';

export interface SessionPayload {
  userId: string;
  email: string;
  workspaceId: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, AUTH_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
    systemRole: true,
    status: true,
    createdAt: true,
    workspaces: {
      include: {
        workspace: true,
      },
    },
  } as const;

  const queryUser = async () => {
    const byId = await prisma.user.findUnique({
      where: { id: session.userId },
      select: userSelect,
    });
    if (byId) return byId;
    if (session.email) {
      return prisma.user.findUnique({
        where: { email: session.email.toLowerCase().trim() },
        select: userSelect,
      });
    }
    return null;
  };

  try {
    let user;
    try {
      user = await queryUser();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
      user = await queryUser();
    }

    if (!user) {
      try {
        cookies().delete(AUTH_COOKIE_NAME);
      } catch (e) {}
      return null;
    }

    // Enforce permanent Super Admin role on verified canonical owner
    if (isOwnerEmail(user.email)) {
      if (user.systemRole !== 'SUPER_ADMIN') {
        await prisma.user.update({
          where: { id: user.id },
          data: { systemRole: 'SUPER_ADMIN' },
        }).catch(() => {});
        user.systemRole = 'SUPER_ADMIN';
      }
    } else {
      const targetSuperAdmin = process.env.SUPER_ADMIN_EMAIL;
      if (targetSuperAdmin && user.email === targetSuperAdmin && user.systemRole !== 'SUPER_ADMIN') {
        await prisma.user.update({
          where: { id: user.id },
          data: { systemRole: 'SUPER_ADMIN' },
        }).catch(() => {});
        user.systemRole = 'SUPER_ADMIN';
      }
    }

    const activeWorkspace =
      user.workspaces.find((w) => w.workspaceId === session.workspaceId)?.workspace ||
      user.workspaces[0]?.workspace;

    if (!activeWorkspace) {
      try {
        cookies().delete(AUTH_COOKIE_NAME);
      } catch (e) {}
      return null;
    }

    return {
      ...user,
      activeWorkspace,
    };
  } catch (error) {
    const emailPrefix = session.email.split('@')[0] || 'User';
    const isOwner = isOwnerEmail(session.email);
    const targetSuperAdmin = process.env.SUPER_ADMIN_EMAIL;
    const isSuperAdmin = isOwner || Boolean(targetSuperAdmin && session.email === targetSuperAdmin);
    const now = new Date();
    const fallbackWorkspace = {
      id: session.workspaceId,
      name: `${emailPrefix}'s Workspace`,
      slug: 'workspace',
      timezone: 'Asia/Karachi',
      plan: 'FREE',
      status: 'ACTIVE',
      suspendedAt: null,
      suspendedReason: null,
      createdAt: now,
      updatedAt: now,
    };

    return {
      id: session.userId,
      email: session.email,
      firstName: emailPrefix,
      lastName: '',
      avatarUrl: null,
      systemRole: isSuperAdmin ? 'SUPER_ADMIN' : 'USER',
      status: 'ACTIVE',
      createdAt: now,
      workspaces: [
        {
          id: session.workspaceId,
          workspaceId: session.workspaceId,
          userId: session.userId,
          role: 'OWNER',
          joinedAt: now,
          workspace: fallbackWorkspace,
        },
      ],
      activeWorkspace: fallbackWorkspace,
    };
  }
}
