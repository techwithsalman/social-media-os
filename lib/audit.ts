import prisma from './prisma';

export async function logActivity(input: {
  workspaceId?: string | null;
  userId?: string | null;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.activityLog.create({
    data: {
      workspaceId: input.workspaceId || null,
      userId: input.userId || null,
      actorUserId: input.actorUserId || null,
      targetUserId: input.targetUserId || null,
      action: input.action,
      details: input.details || null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
