import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== 'Bearer AUTO_DM_SECURE_MIGRATE_123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      AUTO_DM_APP_ID: !!process.env.AUTO_DM_INSTAGRAM_APP_ID,
      AUTO_DM_APP_SECRET: !!process.env.AUTO_DM_INSTAGRAM_APP_SECRET,
      AUTO_DM_WEBHOOK_VERIFY_TOKEN: !!process.env.AUTO_DM_WEBHOOK_VERIFY_TOKEN,
      AUTO_DM_REDIRECT_URI: !!process.env.AUTO_DM_INSTAGRAM_REDIRECT_URI
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
