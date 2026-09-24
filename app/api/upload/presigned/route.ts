import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPresignedUploadUrl, isR2Configured } from '@/lib/storage/r2';
import { EntitlementError, assertCanUploadFile } from '@/lib/billing';

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
    await assertCanUploadFile(session.workspaceId, fileSize);

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
