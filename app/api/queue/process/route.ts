import { NextRequest, NextResponse } from 'next/server';
import { processDueScheduledPosts } from '@/lib/queue/worker';

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      const secretParam = req.nextUrl.searchParams.get('secret');

      const isHeaderValid = authHeader === `Bearer ${cronSecret}`;
      const isParamValid = secretParam === cronSecret;

      if (!isHeaderValid && !isParamValid) {
        return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
      }
    }

    const result = await processDueScheduledPosts();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Queue processing error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
