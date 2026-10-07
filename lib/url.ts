import { NextRequest } from 'next/server';

export function getBaseUrl(req: NextRequest | Request) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  // Always force the production domain if running on the Netlify fallback URL
  if (!host || host.includes('.netlify.app')) {
    return 'https://app.techwithsalman.online';
  }
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
