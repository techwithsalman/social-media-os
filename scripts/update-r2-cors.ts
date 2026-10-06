import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
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

async function updateCors() {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    console.error('R2_BUCKET_NAME is not set.');
    process.exit(1);
  }

  const corsRules = {
    CORSRules: [
      {
        AllowedHeaders: ['Content-Type'],
        AllowedMethods: ['GET', 'PUT', 'HEAD', 'POST', 'DELETE'],
        AllowedOrigins: [
          'https://app.techwithsalman.online',
          'https://social-media-os.netlify.app',
          'http://localhost:3000'
        ],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      }
    ]
  };

  try {
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsRules,
    });
    
    await client.send(command);
    console.log('Successfully updated R2 CORS configuration.');
  } catch (err) {
    console.error('Failed to update R2 CORS:', err);
  }
}

updateCors();
