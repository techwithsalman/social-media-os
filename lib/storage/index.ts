export interface StoredFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface IStorageProvider {
  uploadFile(file: Buffer, filename: string, mimeType: string): Promise<StoredFile>;
  deleteFile(urlOrFilename: string): Promise<boolean>;
  getPublicUrl(filename: string): string;
}

import { LocalStorageProvider } from './localStorage';
import { S3StorageProvider } from './s3Storage';
import { isR2Configured } from './r2';

export function getStorageProvider(): IStorageProvider {
  const provider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
  if (provider === 's3' || provider === 'r2' || isR2Configured()) {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}
