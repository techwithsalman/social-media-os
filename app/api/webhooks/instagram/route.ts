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
  try {
    const rawBody = await req.text();
    console.log('[IG_WEBHOOK] POST_RECEIVED');
    
    const signature = req.headers.get('x-hub-signature-256');
    const secret = process.env.AUTO_DM_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;

    // Verify signature if secret is available
    if (signature && secret) {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return new NextResponse('Invalid signature', { status: 401 });
      }
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return new NextResponse('Invalid JSON', { status: 400 });
    }

    if (payload.object !== 'instagram') {
      return new NextResponse('OK', { status: 200 });
    }

    // Process entries
    for (const entry of payload.entry || []) {
      const igAccountId = entry.id; // Instagram Account ID
      console.log(`[IG_WEBHOOK] ENTRY_ID_PRESENT=${!!igAccountId}`);
      for (const change of entry.changes || []) {
        console.log('[IG_WEBHOOK] FIELD=' + change.field);
        if (change.field === 'comments') {
          await processCommentWebhook(igAccountId, change.value);
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('[IG Webhook Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function resolveAccountByEntryId(igAccountId: string) {
  let account = await prisma.socialAccount.findFirst({
    where: { platformAccountId: igAccountId, platform: 'INSTAGRAM' },
    include: { token: true }
  });

  if (account) {
    console.log('[IG_WEBHOOK] DB_ACCOUNT_MATCH_BY_ENTRY_ID=true (Exact Match)');
    return account;
  }

  console.log('[IG_WEBHOOK] DB_ACCOUNT_MATCH_BY_ENTRY_ID=false');
  console.log('[IG_WEBHOOK] MEDIA_OWNER_RESOLUTION_ATTEMPT');

  // Fallback: Webhook might be sending an IGSID. Fetch accounts with Auto DM tokens to resolve.
  const activeRules = await prisma.instagramAutoDmRule.findMany({
    where: { enabled: true },
    include: { socialAccount: { include: { token: true } } }
  });

  const candidateAccounts = new Map();
  for (const rule of activeRules) {
    if (rule.socialAccount?.token?.autoDmAccessToken) {
      candidateAccounts.set(rule.socialAccount.id, rule.socialAccount);
    }
  }

  for (const acc of Array.from(candidateAccounts.values())) {
    try {
      console.log(`[IG_WEBHOOK] CANDIDATE_DB_PLATFORM_ACCOUNT_ID=${acc.platformAccountId}`);
      const token = decryptToken(acc.token.autoDmAccessToken);
      const res = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`);
      
      if (!res.ok) {
        console.log(`[IG_WEBHOOK] GRAPH_ME_CALL_FAILED status=${res.status}`);
        continue;
      }
      
      const data = await res.json();
      console.log(`[IG_WEBHOOK] GRAPH_ME_ID=${data.id}`);
      if (data.username) {
        console.log(`[IG_WEBHOOK] GRAPH_ME_USERNAME=${data.username}`);
      }

      if (data.id === igAccountId) {
        console.log('[IG_WEBHOOK] MEDIA_OWNER_RESOLUTION_SUCCESS');
        return acc;
      }
    } catch (e: any) {
      console.log(`[IG_WEBHOOK] CANDIDATE_ERROR=${e.message}`);
    }
  }

  return null;
}

async function processCommentWebhook(igAccountId: string, value: any) {
  const { id: commentId, from, text, media } = value;
  
  if (!commentId || !from || !text || !media) return;
  console.log('[IG_WEBHOOK] COMMENT_RECEIVED');
  
  const commenterId = from.id;
  const mediaId = media.id;

  console.log(`[IG_WEBHOOK] ENTRY_ID=${igAccountId}`);
  console.log(`[IG_WEBHOOK] MEDIA_ID=${mediaId}`);
  console.log(`[IG_WEBHOOK] COMMENTER_ID=${commenterId}`);

  // Do not reply to self
  if (commenterId === igAccountId) return;

  const account = await resolveAccountByEntryId(igAccountId);

  if (!account) {
    console.log('[IG_WEBHOOK] ACCOUNT_MATCH_NOT_FOUND');
    return;
  }
  console.log('[IG_WEBHOOK] ACCOUNT_MATCH_FOUND');

  // BUG FIX: Do not reject an account just because it has a publishing accessToken.
  if (!account.token || !account.token.autoDmAccessToken) {
    console.log('[IG_WEBHOOK] AUTO_DM_TOKEN_PRESENT=false');
    return;
  }
  console.log('[IG_WEBHOOK] AUTO_DM_TOKEN_PRESENT=true');

  // Find active rules for this media
  const rules = await prisma.instagramAutoDmRule.findMany({
    where: {
      socialAccountId: account.id,
      OR: [{ mediaId: mediaId }, { mediaId: "ANY" }],
      enabled: true
    }
  });

  console.log('[IG_WEBHOOK] ACTIVE_RULES_FOUND=' + rules.length);
  if (!rules.length) return;

  for (const rule of rules) {
    const isMatch = rule.matchType === 'EXACT'
      ? text.trim().toLowerCase() === rule.keyword.toLowerCase()
      : text.toLowerCase().includes(rule.keyword.toLowerCase());

    console.log('[IG_WEBHOOK] KEYWORD_MATCH=' + isMatch);

    if (isMatch) {
      // Check idempotency
      const existing = await prisma.instagramAutoDmExecution.findUnique({
        where: { ruleId_commentId: { ruleId: rule.id, commentId } }
      });

      if (existing) continue;

      // Create pending execution
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

      // Send the DM
      try {
        console.log('[IG_WEBHOOK] DM_SEND_ATTEMPT');
        const accessToken = decryptToken(account.token.autoDmAccessToken);
        await sendInstagramPrivateReply(igAccountId, commentId, rule, accessToken);
        
        await prisma.instagramAutoDmExecution.update({
          where: { id: execution.id },
          data: { status: 'SENT', sentAt: new Date() }
        });
        console.log('[IG_WEBHOOK] DM_SEND_SUCCESS');
      } catch (err: any) {
        console.log('[IG_WEBHOOK] DM_SEND_FAILED code/status only: ' + (err.message || 'Unknown error'));
        await prisma.instagramAutoDmExecution.update({
          where: { id: execution.id },
          data: { status: 'FAILED', error: err.message || 'Unknown error' }
        });
      }

      // Stop processing rules for this comment once one matches
      break; 
    }
  }
}

async function sendInstagramPrivateReply(igAccountId: string, commentId: string, rule: any, accessToken: string) {
  // Graph API: POST /{ig_user_id}/messages
  // Private reply payload requires recipient to be the comment_id
  const url = buildMetaGraphUrl(`/me/messages`);
  
  const payload: any = {
    recipient: { comment_id: commentId },
    message: { }
  };

  if (rule.buttonLabel && rule.destinationUrl) {
    payload.message = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: rule.message,
          buttons: [
            {
              type: 'web_url',
              url: rule.destinationUrl,
              title: rule.buttonLabel
            }
          ]
        }
      }
    };
  } else {
    payload.message = { text: rule.message };
  }

  const res = await fetch(`${url}?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Failed to send private reply');
  }
  return data;
}
