import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'smos_session_token';
const AUTH_SECRET = process.env.AUTH_SECRET || 'social-media-os-dev-super-secure-session-secret-key-32chars';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/create-post',
  '/bulk-upload',
  '/calendar',
  '/scheduled',
  '/published',
  '/accounts',
  '/analytics',
  '/team',
  '/billing',
  '/settings',
  '/super-admin',
];

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyEdgeToken(tokenStr: string, secretStr: string) {
  try {
    const parts = tokenStr.split('.');
    if (parts.length !== 3) return null;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretStr),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = enc.encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlToUint8Array(parts[2]);

    const isValid = await crypto.subtle.verify('HMAC', key, signature.buffer as ArrayBuffer, data);
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(parts[1]));
    const payload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    if (!payload.userId || !payload.email || !payload.workspaceId) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const validSession = rawToken ? await verifyEdgeToken(rawToken, AUTH_SECRET) : null;

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected && !validSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(url);
    if (rawToken) {
      res.cookies.delete(AUTH_COOKIE_NAME);
    }
    return res;
  }

  if (pathname === '/') {
    const target = validSession ? '/dashboard' : '/login';
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (validSession && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads|.*\\..*).*)'],
};




