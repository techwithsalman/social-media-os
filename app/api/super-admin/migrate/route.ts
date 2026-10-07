import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function GET(req: Request) {
  try {
    let dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl) return NextResponse.json({ error: 'No db url' });
    let directUrl = dbUrl;
    if (dbUrl.includes('-pooler')) {
      directUrl = dbUrl.replace('-pooler', '');
    }
    if (directUrl.includes('pgbouncer=true')) {
      directUrl = directUrl.replace('pgbouncer=true', '');
      directUrl = directUrl.replace('?&', '?').replace('&&', '&');
      if (directUrl.endsWith('?')) directUrl = directUrl.slice(0, -1);
    }
    const out = execSync('npx prisma migrate deploy', { 
      env: { ...process.env, DATABASE_URL: directUrl },
      cwd: process.cwd()
    }).toString();
    return NextResponse.json({ success: true, out });
  } catch (e: any) {
    return NextResponse.json({ error: String(e), stdout: e.stdout?.toString(), stderr: e.stderr?.toString() });
  }
}
