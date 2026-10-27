import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadMediaAsset, resolveMediaAccessUrl } from '@/lib/storage/r2';
import prisma from '@/lib/prisma';
import { EntitlementError, assertCanUploadFile, recordUploadedBytes } from '@/lib/billing';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * GET /api/upload
 * Returns existing MediaAssets for the active workspace, enabling media library reuse
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'video' | 'image'
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);

    const where: any = {
      workspaceId: session.workspaceId,
    };
    if (type === 'video') {
      where.mimeType = { startsWith: 'video/' };
    } else if (type === 'image') {
      where.mimeType = { startsWith: 'image/' };
    }

    const assets = await prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const mediaWithUrls = await Promise.all(
      assets.map(async (asset) => {
        try {
          const playbackUrl = await resolveMediaAccessUrl(asset.url, session.workspaceId);
          return {
            ...asset,
            playbackUrl,
          };
        } catch {
          return {
            ...asset,
            playbackUrl: asset.url,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      mediaAssets: mediaWithUrls,
    });
  } catch (error: any) {
    console.error('Fetch Media Assets Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch media assets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload
 * Fallback direct multipart upload endpoint for small media files
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type (${file.type}). Supported formats: JPG, PNG, WEBP, MP4, MOV.`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds the maximum upload limit of 50MB.' },
        { status: 400 }
      );
    }

    // Single-Object deduplication check
    const existingAsset = await prisma.mediaAsset.findFirst({
      where: {
        workspaceId: session.workspaceId,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAsset) {
      const playbackUrl = await resolveMediaAccessUrl(existingAsset.url, session.workspaceId);
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        media: {
          ...existingAsset,
          url: playbackUrl,
        },
      });
    }

    await assertCanUploadFile(session.workspaceId, file.size);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload file to Cloudflare R2 storage (tenant-scoped)
    const stored = await uploadMediaAsset(session.workspaceId, file.name, buffer, file.type);

    if (!stored || (!stored.url && !stored.key)) {
      return NextResponse.json({ error: 'Failed to upload media asset to Cloudflare R2.' }, { status: 500 });
    }

    // Save MediaAsset to database with key and playback presigned URL
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        workspaceId: session.workspaceId,
        filename: stored.key,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: stored.key || stored.url,
        thumbnailUrl: stored.url,
      },
    });

    await recordUploadedBytes(session.workspaceId, mediaAsset.size);

    return NextResponse.json({
      success: true,
      media: {
        ...mediaAsset,
        url: stored.url, // Return immediate playback presigned URL to UI
      },
    });
  } catch (error: any) {
    console.error('Upload Error:', error);
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'File upload failed' }, { status: 500 });
  }
}
