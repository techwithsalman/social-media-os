import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from './prisma';

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

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
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
      },
    });

    if (!user) {
      try {
        cookies().delete(AUTH_COOKIE_NAME);
      } catch (e) {}
      return null;
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
    return null;
  }
}
