import { NextRequest } from 'next/server';

export function verifyCsrfOrigin(req: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  
  // If no origin and no referer, reject if required, but some valid clients omit them. 
  // For strict CSRF, we require at least one.
  if (!origin && !referer) {
     return false; 
  }

  try {
    const targetUrl = new URL(req.url);
    const originUrl = origin ? new URL(origin) : new URL(referer!);
    
    // Allow same-origin
    if (originUrl.origin === targetUrl.origin) {
      return true;
    }
    
    return false;
  } catch (e) {
    return false;
  }
}
