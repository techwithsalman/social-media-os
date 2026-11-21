import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/super-admin';

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();

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
    if ((error as any)?.status) {
      return adminErrorResponse(error);
    }
    console.error('Migration failed:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}
