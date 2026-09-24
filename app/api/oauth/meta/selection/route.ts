import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  connectSelectedMetaAccounts,
  getMetaSelectionView,
  MetaOAuthError,
} from '@/lib/meta-oauth';

function errorResponse(error: unknown) {
  if (error instanceof MetaOAuthError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: 'Meta account selection failed.' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = new URL(req.url).searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Selection token is required.' }, { status: 400 });
    }

    const selection = await getMetaSelectionView(token, session);
    return NextResponse.json(selection);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const token = typeof body.token === 'string' ? body.token : '';
    const accountIds = Array.isArray(body.accountIds)
      ? body.accountIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    if (!token) {
      return NextResponse.json({ error: 'Selection token is required.' }, { status: 400 });
    }

    const result = await connectSelectedMetaAccounts(token, accountIds, session);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
