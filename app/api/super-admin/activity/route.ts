import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminErrorResponse, requireSuperAdmin } from '@/lib/super-admin';

export async function GET() {
  try {
    await requireSuperAdmin();

    const activity = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      activity: activity.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
