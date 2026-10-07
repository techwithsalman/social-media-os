import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { decryptToken } from '@/lib/crypto';
import { buildMetaGraphUrl } from '@/lib/meta-token-service';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  const verifyToken = process.env.AUTO_DM_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'social_media_os_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const diagnosticLogs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    diagnosticLogs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    const rawBody = await req.text();
    log('[IG_WEBHOOK] POST_RECEIVED');

    const signature = req.headers.get('x-hub-signature-256');
    const secret = process.env.AUTO_DM_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;

    if (signature && secret) {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        log('[IG_WEBHOOK] Invalid signature detected');
        return new NextResponse('Invalid signature', { status: 401 });
      }
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      log('[IG_WEBHOOK] Invalid JSON payload');
      return new NextResponse('Invalid JSON', { status: 400 });
    }

    log(`[IG_WEBHOOK] object=${payload.object}`);

    if (payload.object !== 'instagram') {
      return new NextResponse('OK', { status: 200 });
    }

    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    log(`[IG_WEBHOOK] entry_count=${entries.length}`);

    for (const entry of entries) {
      const igAccountId = entry.id;
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      log(`[IG_WEBHOOK] change_count=${changes.length} for account_id=${igAccountId}`);

      for (const change of changes) {
        log(`[IG_WEBHOOK] field=${change.field}`);
        
        if (change.field === 'comments') {
          await processCommentWebhook(igAccountId, change.value, log);
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    log(`[IG Webhook Error] ${error?.message || error}`);
    console.error('[IG Webhook Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  } finally {
    if (diagnosticLogs.length > 0) {
      try {
        await prisma.activityLog.create({
          data: {
            action: 'IG_WEBHOOK_DIAGNOSTIC',
            details: 'Instagram Webhook Trace',
            metadata: JSON.stringify({ logs: diagnosticLogs })
          }
        });
      } catch (e) {
        console.error('Failed to save webhook diagnostic log to DB', e);
      }
    }
  }
}

async function processCommentWebhook(igAccountId: string, value: any, log: (msg: string) => void) {
  const commentId = value?.id;
  const commenterId = value?.from?.id;
  const text = value?.text;
  const mediaId = value?.media?.id;

  log(`[IG_WEBHOOK] comment_id=${commentId}`);
  log(`[IG_WEBHOOK] media_id=${mediaId}`);
  log(`[IG_WEBHOOK] has_text=${!!text}`);

  if (!commentId || !commenterId || !text || !mediaId) {
    log('[IG_WEBHOOK] Missing required comment payload fields. Skipping.');
    return;
  }

  // Do not reply to self
  if (commenterId === igAccountId) {
    log('[IG_WEBHOOK] Comment is from the account itself. Skipping.');
    return;
  }

  const account = await prisma.socialAccount.findFirst({
    where: { platformAccountId: igAccountId, platform: 'INSTAGRAM' },
    include: { token: true }
  });

  if (!account) {
    log('[IG_WEBHOOK] ACCOUNT_MATCH_NOT_FOUND');
    return;
  }
  
  log('[IG_WEBHOOK] ACCOUNT_MATCH_FOUND');

  if (!account.token || !account.token.autoDmAccessToken) {
    log('[IG_WEBHOOK] AUTO_DM_TOKEN_PRESENT=false');
    return;
  }
  
  log('[IG_WEBHOOK] AUTO_DM_TOKEN_PRESENT=true');

  const rules = await prisma.instagramAutoDmRule.findMany({
    where: {
      socialAccountId: account.id,
      OR: [{ mediaId: mediaId }, { mediaId: "ANY" }],
      enabled: true
    }
  });

  log(`[IG_WEBHOOK] ACTIVE_RULES_FOUND=${rules.length}`);

  if (!rules.length) return;

  for (const rule of rules) {
    const isMatch = rule.matchType === 'EXACT'
      ? text.trim().toLowerCase() === rule.keyword.toLowerCase()
      : text.toLowerCase().includes(rule.keyword.toLowerCase());

    log(`[IG_WEBHOOK] KEYWORD_MATCH=${isMatch} for rule=${rule.id}`);

    if (isMatch) {
      log(`[IG_WEBHOOK] RULE_MATCHED=${rule.id}`);

      // Check idempotency
      const existing = await prisma.instagramAutoDmExecution.findUnique({
        where: { ruleId_commentId: { ruleId: rule.id, commentId } }
      });

      if (existing) {
        log('[IG_WEBHOOK] Execution already exists. Skipping.');
        continue;
      }

      const execution = await prisma.instagramAutoDmExecution.create({
        data: {
          ruleId: rule.id,
          workspaceId: rule.workspaceId,
          socialAccountId: account.id,
          commentId,
          commenterId,
          commentText: text,
          status: 'PENDING'
        }
      });

      try {
        log('[IG_WEBHOOK] DM_SEND_ATTEMPT');
        const accessToken = decryptToken(account.token.autoDmAccessToken);
        await sendInstagramPrivateReply(igAccountId, commentId, rule, accessToken);
        
        await prisma.instagramAutoDmExecution.update({
          where: { id: execution.id },
          data: { status: 'SENT', sentAt: new Date() }
        });
        log('[IG_WEBHOOK] DM_SEND_SUCCESS');
      } catch (err: any) {
        log(`[IG_WEBHOOK] DM_SEND_FAILED error="${err.message}"`);
        await prisma.instagramAutoDmExecution.update({
          where: { id: execution.id },
          data: { status: 'FAILED', error: err.message || 'Unknown error' }
        });
      }

      break; 
    }
  }
}

async function sendInstagramPrivateReply(igAccountId: string, commentId: string, rule: any, accessToken: string) {
  const url = buildMetaGraphUrl('/me/messages');
  
  const payload: any = {
    recipient: { comment_id: commentId },
    message: { text: rule.message }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const metaError = data.error?.message || 'Unknown Meta error';
    throw new Error(metaError);
  }
}
