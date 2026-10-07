import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (user.systemRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const prisma = new PrismaClient();
    const statements = [
      'CREATE TABLE "FacebookAutoDmRule" ("id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "socialAccountId" TEXT NOT NULL, "pageId" TEXT NOT NULL, "postId" TEXT NOT NULL, "name" TEXT NOT NULL, "keyword" TEXT NOT NULL, "matchType" TEXT NOT NULL DEFAULT \'EXACT\', "message" TEXT NOT NULL, "buttonLabel" TEXT, "destinationUrl" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FacebookAutoDmRule_pkey" PRIMARY KEY ("id"))',
      'CREATE TABLE "FacebookAutoDmExecution" ("id" TEXT NOT NULL, "ruleId" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "socialAccountId" TEXT NOT NULL, "commentId" TEXT NOT NULL, "commenterId" TEXT NOT NULL, "commentText" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT \'SENT\', "error" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "sentAt" TIMESTAMP(3), CONSTRAINT "FacebookAutoDmExecution_pkey" PRIMARY KEY ("id"))',
      'CREATE INDEX "FacebookAutoDmRule_workspaceId_idx" ON "FacebookAutoDmRule"("workspaceId")',
      'CREATE INDEX "FacebookAutoDmRule_socialAccountId_postId_enabled_idx" ON "FacebookAutoDmRule"("socialAccountId", "postId", "enabled")',
      'CREATE INDEX "FacebookAutoDmExecution_workspaceId_idx" ON "FacebookAutoDmExecution"("workspaceId")',
      'CREATE UNIQUE INDEX "FacebookAutoDmExecution_ruleId_commentId_key" ON "FacebookAutoDmExecution"("ruleId", "commentId")',
      'ALTER TABLE "FacebookAutoDmRule" ADD CONSTRAINT "FacebookAutoDmRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "FacebookAutoDmRule" ADD CONSTRAINT "FacebookAutoDmRule_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "FacebookAutoDmExecution" ADD CONSTRAINT "FacebookAutoDmExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "FacebookAutoDmRule"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "FacebookAutoDmExecution" ADD CONSTRAINT "FacebookAutoDmExecution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "FacebookAutoDmExecution" ADD CONSTRAINT "FacebookAutoDmExecution_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    ];
      
    let executed = 0;
    let skipped = 0;
    
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        executed++;
      } catch (e: any) {
        const msg = String(e);
        if (msg.includes('already exists')) {
          skipped++;
        } else {
          return NextResponse.json({ error: 'Migration failed safely on statement execution.' }, { status: 500 });
        }
      }
    }
    
    return NextResponse.json({ success: true, executed, skipped, message: 'Migration idempotent pass completed.' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Block GET entirely
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
