import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminErrorResponse, requireSuperAdmin } from '@/lib/super-admin';

export async function GET() {
  try {
    await requireSuperAdmin();

    const subscriptions = await prisma.subscription.findMany({
      include: {
        plan: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            members: {
              take: 1,
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      subscriptions: subscriptions.map((subscription) => ({
        ...subscription,
        startedAt: subscription.startedAt.toISOString(),
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() || null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
        trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
