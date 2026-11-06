import { test as base, BrowserContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Ensure .env is loaded before importing lib/auth
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { signSessionToken, AUTH_COOKIE_NAME } from '../../lib/auth';
import prisma from '../../lib/prisma';

export interface TestUserSession {
  token: string;
  userId: string;
  email: string;
  workspaceId: string;
}

export async function getSessionForUser(email = 'salmandesigner24@gmail.com'): Promise<TestUserSession> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { workspaces: true },
  });

  if (!user || user.workspaces.length === 0) {
    throw new Error(`Test user ${email} not found or has no workspaces`);
  }

  const workspaceId = user.workspaces[0].workspaceId;
  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    workspaceId,
  });

  return {
    token,
    userId: user.id,
    email: user.email,
    workspaceId,
  };
}

export async function injectAuthSession(context: BrowserContext, session: TestUserSession) {
  await context.addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: session.token,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

export const test = base.extend<{ authSession: TestUserSession }>({
  authSession: [
    async ({ context }, use) => {
      const session = await getSessionForUser('salmandesigner24@gmail.com');
      await injectAuthSession(context, session);
      await use(session);
    },
    { auto: true }, // Automatically run for every test
  ],
});

export { expect } from '@playwright/test';
