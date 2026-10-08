import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPresignedUploadUrl, isR2Configured } from '@/lib/storage/r2';
import { EntitlementError, assertCanUploadFile } from '@/lib/billing';
import { checkPlanLimit, PlanLimitError, createPlanLimitResponse } from '@/lib/billing/plan-limits';
import prisma from '@/lib/prisma';


const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
];

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'Cloudflare R2 storage is not configured on server.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { filename, mimeType, size } = body;

    if (!filename || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required parameters: filename, mimeType' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Invalid file type (${mimeType}). Supported formats: JPG, PNG, WEBP, MP4, MOV.` },
        { status: 400 }
      );
    }

    const fileSize = size || 10 * 1024 * 1024; // Default 10MB check if unprovided

    if (fileSize > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File is too large. Maximum size is 50 MB.' },
        { status: 413 }
      );
    }

    await assertCanUploadFile(session.workspaceId, fileSize);

    if (mimeType.startsWith('video/')) {
      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      
      const videoCount = await prisma.mediaAsset.count({
        where: {
          workspaceId: session.workspaceId,
          mimeType: { startsWith: 'video/' },
          createdAt: { gte: periodStart }
        }
      });
      try {
        await checkPlanLimit(session.workspaceId, 'bulkUploadVideos', videoCount);
      } catch (error: any) {
        if (error instanceof PlanLimitError) return createPlanLimitResponse(error);
      }
    }

    const { uploadUrl, objectKey } = await getPresignedUploadUrl(
      session.workspaceId,
      filename,
      mimeType,
      900 // 15 minutes validity
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      objectKey,
      workspaceId: session.workspaceId,
      expiresInSeconds: 900,
    });
  } catch (error: any) {
    console.error('Presigned Upload Error:', error);
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to generate presigned upload URL' },
      { status: 500 }
    );
  }
}



