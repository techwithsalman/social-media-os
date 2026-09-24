import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, signSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { WORKSPACE_TIMEZONE } from '@/lib/timezone';
import { ensureDefaultPlans, getPlanByCode } from '@/lib/billing';

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, password, confirmPassword } = await req.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    await ensureDefaultPlans();
    const freePlan = await getPlanByCode('FREE');

    // Create user and default workspace inside a transaction
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
      },
    });

    const workspaceSlug = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}-workspace-${Math.random()
      .toString(36)
      .substring(2, 6)}`;

    const workspace = await prisma.workspace.create({
      data: {
        name: `${firstName}'s Workspace`,
        slug: workspaceSlug,
        timezone: WORKSPACE_TIMEZONE,
        plan: 'FREE',
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });

    // Create welcome notification
    await prisma.notification.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Welcome to Social Media OS! 🚀',
        message: 'Get started by connecting your social accounts or creating your first multi-platform post.',
        type: 'SUCCESS',
        link: '/accounts',
      },
    });

    await prisma.subscription.create({
      data: {
        workspaceId: workspace.id,
        planId: freePlan.id,
        planTier: freePlan.code,
        status: 'ACTIVE',
        source: 'MANUAL',
        startedAt: new Date(),
        currentPeriodStart: new Date(),
      },
    });

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      workspaceId: workspace.id,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Signup Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
