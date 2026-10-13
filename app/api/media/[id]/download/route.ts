import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  extractObjectKey,
  getPresignedDownloadUrl,
  isR2Configured,
  resolveMediaAccessUrl,
  verifyR2ObjectWorkspaceOwnership,
} from '@/lib/storage/r2';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mediaId = params.id;
    if (!mediaId) {
      return NextResponse.json({ error: 'Media asset ID is required' }, { status: 400 });
    }

    const mediaAsset = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!mediaAsset) {
      return NextResponse.json({ error: 'Media asset not found.' }, { status: 404 });
    }

    // Strict workspace tenant boundary
    if (mediaAsset.workspaceId !== session.workspaceId) {
      return NextResponse.json(
        { error: 'Forbidden: Access to this media asset is denied.' },
        { status: 403 }
      );
    }

    const cleanFilename = (mediaAsset.originalName || mediaAsset.filename || 'media')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    // Generate short-lived (5-minute) signed access URL
    let downloadUrl = '';
    const objectKey = extractObjectKey(mediaAsset.url);

    if (objectKey && isR2Configured()) {
      if (!verifyR2ObjectWorkspaceOwnership(objectKey, session.workspaceId)) {
        return NextResponse.json({ error: 'Unauthorized workspace object.' }, { status: 403 });
      }
      downloadUrl = await getPresignedDownloadUrl(objectKey, 300);
    } else {
      downloadUrl = await resolveMediaAccessUrl(mediaAsset.url, session.workspaceId);
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Unable to resolve secure media download URL.' },
        { status: 500 }
      );
    }

    // If client requested JSON via Accept header
    const acceptHeader = req.headers.get('accept') || '';
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({
        success: true,
        downloadUrl,
        filename: cleanFilename,
        mimeType: mediaAsset.mimeType,
        size: mediaAsset.size,
      });
    }

    // Browser navigation / click -> redirect directly to the short-lived signed URL
    return NextResponse.redirect(downloadUrl);
  } catch (error: any) {
    console.error('[Media Secure Download Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate secure download.' },
      { status: 500 }
    );
  }
}
