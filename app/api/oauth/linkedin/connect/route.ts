import { getBaseUrl } from '@/lib/url';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createLinkedInAuthorizationUrl, LinkedInOAuthError } from '@/lib/linkedin-oauth';

export const dynamic = 'force-dynamic';

function redirectToAccounts(req: NextRequest, error: string, errorDesc?: string) {
  const url = new URL('/accounts', getBaseUrl(req));
  url.searchParams.set('linkedin_error', error);
  if (errorDesc) {
    url.searchParams.set('linkedin_error_desc', errorDesc);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      const url = new URL('/login', getBaseUrl(req));
      url.searchParams.set('redirect', '/accounts');
      return NextResponse.redirect(url);
    }

    const { url } = await createLinkedInAuthorizationUrl(session);
    return NextResponse.redirect(url);
  } catch (error: any) {
    if (error instanceof LinkedInOAuthError) {
      return redirectToAccounts(req, error.code.toLowerCase(), error.message);
    }
    return redirectToAccounts(req, 'linkedin_oauth_failed', error.message);
  }
}
