import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook, BillingProvider } from '@/lib/payment-gateway';

const SUPPORTED_PLACEHOLDER_PROVIDERS = ['SAFE_PAY', 'STRIPE', 'OTHER'];

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider.toUpperCase() as BillingProvider;

  if (!SUPPORTED_PLACEHOLDER_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Unsupported billing provider.' }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({}));
  const result = await handleWebhook(provider, payload);

  return NextResponse.json(result, { status: 202 });
}
