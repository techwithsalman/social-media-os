import { IStorageProvider, StoredFile } from './index';
import { uploadMediaAsset, deleteR2Object, isR2Configured, getPresignedDownloadUrl } from './r2';

/**
 * Production-ready Cloudflare R2 / S3 storage provider adapter
 */
export class S3StorageProvider implements IStorageProvider {
  async uploadFile(file: Buffer, filename: string, mimeType: string): Promise<StoredFile> {
    const result = await uploadMediaAsset('default', filename, file, mimeType);
    return {
      filename: result.key,
      originalName: filename,
      mimeType,
      size: file.length,
      url: result.url,
      thumbnailUrl: mimeType.startsWith('image/') ? result.url : undefined,
    };
  }

  async deleteFile(urlOrFilename: string): Promise<boolean> {
    const res = await deleteR2Object(urlOrFilename, 'default');
    return res.success;
  }

  getPublicUrl(filename: string): string {
    if (isR2Configured() && filename.startsWith('workspaces/')) {
      if (process.env.R2_PUBLIC_DOMAIN) {
        const publicDomain = process.env.R2_PUBLIC_DOMAIN.replace(/\/+$/, '');
        return `${publicDomain}/${filename}`;
      }
    }
    return filename;
  }
}
