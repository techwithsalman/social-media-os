import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const prisma = new PrismaClient();
    const statements = [
      \CREATE TABLE "InstagramAutoDmRule" ("id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "socialAccountId" TEXT NOT NULL, "name" TEXT NOT NULL, "mediaId" TEXT NOT NULL, "keyword" TEXT NOT NULL, "matchType" TEXT NOT NULL DEFAULT 'EXACT', "message" TEXT NOT NULL, "buttonLabel" TEXT, "destinationUrl" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "InstagramAutoDmRule_pkey" PRIMARY KEY ("id"))\,
      \CREATE TABLE "InstagramAutoDmExecution" ("id" TEXT NOT NULL, "ruleId" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "socialAccountId" TEXT NOT NULL, "commentId" TEXT NOT NULL, "commenterId" TEXT NOT NULL, "commentText" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'SENT', "error" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "sentAt" TIMESTAMP(3), CONSTRAINT "InstagramAutoDmExecution_pkey" PRIMARY KEY ("id"))\,
      \CREATE INDEX "InstagramAutoDmRule_workspaceId_idx" ON "InstagramAutoDmRule"("workspaceId")\,
      \CREATE INDEX "InstagramAutoDmRule_socialAccountId_mediaId_enabled_idx" ON "InstagramAutoDmRule"("socialAccountId", "mediaId", "enabled")\,
      \CREATE INDEX "InstagramAutoDmExecution_workspaceId_idx" ON "InstagramAutoDmExecution"("workspaceId")\,
      \CREATE UNIQUE INDEX "InstagramAutoDmExecution_ruleId_commentId_key" ON "InstagramAutoDmExecution"("ruleId", "commentId")\,
      \ALTER TABLE "InstagramAutoDmRule" ADD CONSTRAINT "InstagramAutoDmRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE\,
      \ALTER TABLE "InstagramAutoDmRule" ADD CONSTRAINT "InstagramAutoDmRule_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE\,
      \ALTER TABLE "InstagramAutoDmExecution" ADD CONSTRAINT "InstagramAutoDmExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "InstagramAutoDmRule"("id") ON DELETE CASCADE ON UPDATE CASCADE\,
      \ALTER TABLE "InstagramAutoDmExecution" ADD CONSTRAINT "InstagramAutoDmExecution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE\,
      \ALTER TABLE "InstagramAutoDmExecution" ADD CONSTRAINT "InstagramAutoDmExecution_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE\
    ];
      
    const results = [];
    
    for (const stmt of statements) {
      try {
        await prisma.\(stmt);
        results.push({ stmt: stmt.substring(0, 50) + '...', status: 'success' });
      } catch (e: any) {
        results.push({ stmt: stmt.substring(0, 50) + '...', status: 'error', error: String(e) });
      }
    }
    
    let hasRule = false;
    let hasExec = false;
    try {
      // @ts-ignore
      await prisma.instagramAutoDmRule.findFirst();
      hasRule = true;
    } catch (e) {}
    try {
      // @ts-ignore
      await prisma.instagramAutoDmExecution.findFirst();
      hasExec = true;
    } catch (e) {}
    
    return NextResponse.json({ 
      success: true, 
      results,
      InstagramAutoDmRule: hasRule,
      InstagramAutoDmExecution: hasExec
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) });
  }
}
