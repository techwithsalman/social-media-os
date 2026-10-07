import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  const directUrl = process.env.DIRECT_URL || '';
  
  const parseHost = (url) => {
    try {
      if (!url) return null;
      const u = new URL(url);
      return u.hostname + u.pathname;
    } catch (e) {
      return 'invalid-url';
    }
  };

  return NextResponse.json({
    DATABASE_URL_HOST: parseHost(dbUrl),
    DIRECT_URL_HOST: parseHost(directUrl),
  });
}
