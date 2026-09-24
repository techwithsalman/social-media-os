import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        value = value.replace(/^["']|["']$/g, ''); // strip quotes
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

async function testR2Connection() {
  loadEnvFile();

  console.log('=== CLOUDFLARE R2 CONNECTION TEST ===\n');

  // 1. Verify R2 environment variables without printing secret values
  const accountId = (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '').trim();
  const bucketName = (process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'social-media-os-videos').trim();

  console.log('Environment Variables Loaded Check:');
  console.log('- R2_ACCOUNT_ID present:', Boolean(accountId));
  console.log('- R2_ACCESS_KEY_ID present:', Boolean(accessKeyId));
  console.log('- R2_SECRET_ACCESS_KEY present:', Boolean(secretAccessKey));
  console.log('- Target R2 Bucket Name:', bucketName);

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('\n=== RESULT: FAIL ===');
    console.error('Missing Cloudflare R2 credentials in .env file.');
    console.error('Required credentials to add to .env:');
    console.error('R2_ACCOUNT_ID="your_account_id"');
    console.error('R2_ACCESS_KEY_ID="your_access_key_id"');
    console.error('R2_SECRET_ACCESS_KEY="your_secret_access_key"');
    console.error('R2_BUCKET_NAME="social-media-os-videos"');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const testKey = `test_connection_${Date.now()}.txt`;
  const testContent = Buffer.from(`Social Media OS R2 Connection Verification Test ${new Date().toISOString()}`);

  try {
    // 2. Upload tiny temporary test file
    console.log(`\n1. Uploading temporary test file to bucket '${bucketName}' with key '${testKey}'...`);
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: testContent,
        ContentType: 'text/plain',
      })
    );
    console.log('✓ File uploaded successfully.');

    // 3. Verify file exists
    console.log(`\n2. Verifying object '${testKey}' exists in bucket '${bucketName}'...`);
    const headResult = await client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      })
    );
    console.log(`✓ Object exists. ContentLength: ${headResult.ContentLength} bytes, ContentType: ${headResult.ContentType}`);

    // 4. Delete ONLY temporary test file
    console.log(`\n3. Deleting temporary test file '${testKey}'...`);
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      })
    );
    console.log('✓ Delete command sent.');

    // 5. Confirm deletion
    console.log(`\n4. Confirming object '${testKey}' is deleted...`);
    let isDeleted = false;
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: testKey,
        })
      );
    } catch (headErr: any) {
      if (headErr.$metadata?.httpStatusCode === 404 || headErr.name === 'NotFound') {
        isDeleted = true;
      } else {
        throw headErr;
      }
    }

    if (isDeleted) {
      console.log('✓ Confirmed: Temporary test file was completely deleted.\n');
      console.log('=== RESULT: PASS ===');
      console.log(`Successfully verified live Cloudflare R2 bucket connection for '${bucketName}'.`);
    } else {
      console.error('\n=== RESULT: FAIL ===');
      console.error('File still exists after deletion attempt.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n=== RESULT: FAIL ===');
    console.error('Cloudflare R2 Error Details:');
    console.error('- Code / Name:', err.name || err.code || 'UNKNOWN_ERROR');
    console.error('- Message:', err.message);
    if (err.$metadata) {
      console.error('- HTTP Status:', err.$metadata.httpStatusCode);
      console.error('- Request ID:', err.$metadata.requestId);
    }
    process.exit(1);
  }
}

testR2Connection();
