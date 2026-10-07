import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== 'Bearer AUTO_DM_SECURE_MIGRATE_123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = new PrismaClient();
    
    const check: any = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='OAuthToken' AND column_name='autoDmAccessToken';
    `;

    if (Array.isArray(check) && check.length > 0) {
      return NextResponse.json({ status: 'EXISTS', message: 'Column autoDmAccessToken already exists.' });
    }

    await prisma.$executeRawUnsafe(`ALTER TABLE "OAuthToken" ADD COLUMN "autoDmAccessToken" TEXT;`);
    
    return NextResponse.json({ status: 'MIGRATED', message: 'Column autoDmAccessToken successfully added.' });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}
