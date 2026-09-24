import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageUploadResult {
  url: string;
  key: string;
  storageProvider: 'R2' | 'LOCAL';
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
  );
}

export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function buildR2ObjectKey(workspaceId: string, fileName: string): string {
  const cleanName = sanitizeFileName(fileName);
  return `workspaces/${workspaceId}/videos/${Date.now()}_${cleanName}`;
}

/**
  * Generate a short-lived presigned HTTP PUT upload URL for direct browser uploads to private R2 bucket
  */
export async function getPresignedUploadUrl(
  workspaceId: string,
  fileName: string,
  mimeType: string,
  expiresInSeconds = 900
): Promise<{ uploadUrl: string; objectKey: string }> {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured in environment variables.');
  }

  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;
  const objectKey = buildR2ObjectKey(workspaceId, fileName);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

  return { uploadUrl, objectKey };
}

/**
  * Generate a short-lived presigned HTTP GET download URL for private R2 object viewing & platform publishing
  */
export async function getPresignedDownloadUrl(
  objectKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured in environment variables.');
  }

  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
  * Enforce workspace tenant boundary on R2 object key
  */
export function verifyR2ObjectWorkspaceOwnership(objectKey: string, workspaceId: string): boolean {
  const expectedPrefix = `workspaces/${workspaceId}/`;
  return objectKey.startsWith(expectedPrefix);
}

/**
 * Safely delete an R2 video object after verifying workspace ownership and configuration
 */
export async function deleteR2Object(
  objectKey: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  if (!objectKey) {
    return { success: false, error: 'Empty object key' };
  }

  // Strict workspace tenant boundary check
  if (!verifyR2ObjectWorkspaceOwnership(objectKey, workspaceId)) {
    const err = `Security Error: Unauthorized workspace deletion attempt for key ${objectKey} by workspace ${workspaceId}`;
    console.error(`[R2 Security Guard] ${err}`);
    return { success: false, error: err };
  }

  if (!isR2Configured()) {
    console.log(`[R2 Storage Simulation] Deletion logged for key ${objectKey} (R2 not configured in env)`);
    return { success: true };
  }

  try {
    const client = getR2Client();
    const bucketName = process.env.R2_BUCKET_NAME!;

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );

    console.log(`[R2 Private Storage] Successfully deleted object key: ${objectKey}`);
    return { success: true };
  } catch (err: any) {
    const msg = err?.message || 'R2 DeleteObjectCommand failed';
    console.error(`[R2 Storage Delete Error] Failed to delete ${objectKey}:`, err);
    return { success: false, error: msg };
  }
}

/**
  * Resolve a media URL or R2 object key into a usable URL for publishing or player display
  */
export async function resolveMediaAccessUrl(mediaUrl: string, workspaceId?: string): Promise<string> {
  if (!mediaUrl) return '';

  // Detect and reject legacy invalid AWS S3 URLs
  if (mediaUrl.includes('amazonaws.com') || mediaUrl.includes('social-media-os-assets.s3')) {
    console.warn(`[R2 Storage Resolver] Flagged legacy invalid S3 URL: ${mediaUrl}`);
    return '';
  }

  // Local uploads or absolute HTTP URLs return as is
  if (mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('http://localhost') || mediaUrl.startsWith('http://127.0.0.1')) {
    return mediaUrl;
  }

  // Handle R2 object keys or R2 domain URLs
  if (
    mediaUrl.includes('r2.cloudflarestorage.com') ||
    mediaUrl.includes('r2.dev') ||
    mediaUrl.startsWith('workspaces/')
  ) {
    let objectKey = mediaUrl;
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      try {
        objectKey = new URL(mediaUrl).pathname.replace(/^\//, '');
      } catch {
        // ignore
      }
    }

    if (workspaceId && !verifyR2ObjectWorkspaceOwnership(objectKey, workspaceId)) {
      throw new Error(`Unauthorized cross-client access to R2 media asset for workspace: ${workspaceId}`);
    }

    if (process.env.R2_PUBLIC_DOMAIN) {
      const publicDomain = process.env.R2_PUBLIC_DOMAIN.replace(/\/+$/, '');
      return `${publicDomain}/${objectKey}`;
    }

    if (isR2Configured()) {
      return getPresignedDownloadUrl(objectKey, 3600);
    }
  }

  return mediaUrl;
}

export async function uploadMediaAsset(
  workspaceId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<StorageUploadResult> {
  const isR2 = isR2Configured();

  if (isR2) {
    try {
      const client = getR2Client();
      const bucketName = process.env.R2_BUCKET_NAME!;
      const objectKey = buildR2ObjectKey(workspaceId, fileName);

      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType,
        })
      );

      const presignedDownloadUrl = await getPresignedDownloadUrl(objectKey, 3600);
      console.log(`[R2 Private Storage] File uploaded to R2 Object Key: ${objectKey}`);

      return {
        url: presignedDownloadUrl,
        key: objectKey,
        storageProvider: 'R2',
      };
    } catch (err) {
      console.error('[R2 Storage Error] Falling back to local storage:', err);
    }
  }

  // Local Storage Fallback
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const uniqueFileName = `${Date.now()}_${sanitizeFileName(fileName)}`;
  const filePath = path.join(uploadsDir, uniqueFileName);
  fs.writeFileSync(filePath, buffer);

  const localUrl = `/uploads/${uniqueFileName}`;

  return {
    url: localUrl,
    key: uniqueFileName,
    storageProvider: 'LOCAL',
  };
}
