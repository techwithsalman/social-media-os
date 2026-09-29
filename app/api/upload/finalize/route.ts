import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { recordUploadedBytes } from '@/lib/billing';
import { resolveMediaAccessUrl } from '@/lib/storage/r2';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { objectKey, filename, mimeType, size } = body;

    if (!objectKey || !filename || !mimeType) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // Generate the playback/download URL for the newly uploaded R2 object
    const playbackUrl = await resolveMediaAccessUrl(objectKey, session.workspaceId);

    // Save MediaAsset to database
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        workspaceId: session.workspaceId,
        filename: objectKey,
        originalName: filename,
        mimeType: mimeType,
        size: size || 0,
        url: objectKey, // We store the actual R2 key as the authoritative URL
        thumbnailUrl: playbackUrl,
      },
    });

    // Record billing usage
    if (size) {
      await recordUploadedBytes(session.workspaceId, size);
    }

    return NextResponse.json({
      success: true,
      media: {
        ...mediaAsset,
        url: playbackUrl, // Return the immediate presigned playback URL to the frontend UI
      },
    });
  } catch (error: any) {
    console.error('Finalize Upload Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to finalize media upload' },
      { status: 500 }
    );
  }
}
