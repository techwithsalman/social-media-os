import { S3Client, GetBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

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

async function readCors() {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;

  try {
    const command = new GetBucketCorsCommand({
      Bucket: bucketName,
    });
    
    const response = await client.send(command);
    console.log('Current R2 CORS:', JSON.stringify(response.CORSRules, null, 2));
  } catch (err) {
    console.error('Failed to get R2 CORS:', err);
  }
}

readCors();
