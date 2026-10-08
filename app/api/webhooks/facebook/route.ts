import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { decryptToken } from '@/lib/crypto';
import { buildMetaGraphUrl } from '@/lib/meta-token-service';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'social_media_os_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const secret = process.env.META_APP_SECRET;

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

    if (payload.object !== 'page') {
      return new NextResponse('OK', { status: 200 });
    }

    // Process entries
    for (const entry of payload.entry || []) {
      const pageId = entry.id; // Facebook Page ID
      for (const change of entry.changes || []) {
        if (change.field === 'feed' && change.value?.item === 'comment' && change.value?.verb === 'add') {
          await processCommentWebhook(pageId, change.value);
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('[FB Webhook Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function processCommentWebhook(pageId: string, value: any) {
  const { comment_id: commentId, from, message, post_id: postId } = value;
  
  console.log('[FB_AUTO_DM] WEBHOOK_RECEIVED=true');
  console.log(`[FB_AUTO_DM] PAGE_ID_PRESENT=${!!pageId}`);
  console.log(`[FB_AUTO_DM] POST_ID_PRESENT=${!!postId}`);
  console.log(`[FB_AUTO_DM] COMMENT_ID_PRESENT=${!!commentId}`);
  console.log(`[FB_AUTO_DM] COMMENT_TEXT_PRESENT=${!!message}`);

  if (!commentId || !from || !message || !postId) return;
  
  const commenterId = from.id;

  // Do not reply to self
  if (commenterId === pageId) return;

  // Find social account
  const account = await prisma.socialAccount.findFirst({
    where: { platformAccountId: pageId, platform: 'FACEBOOK' },
    include: { token: true }
  });

  if (!account || !account.token || !account.token.accessToken) return;

  // Find active rules for this post
  const rules = await prisma.facebookAutoDmRule.findMany({
    where: {
      socialAccountId: account.id,
      OR: [{ postId: postId }, { postId: "ANY" }],
      enabled: true
    }
  });

  if (!rules.length) return;

  for (const rule of rules) {
    let isMatch = false;
    if (rule.matchType === 'ANY_COMMENT') {
      isMatch = true;
    } else if (rule.matchType === 'EXACT') {
      isMatch = message.trim().toLowerCase() === rule.keyword.trim().toLowerCase();
    } else { // CONTAINS
      isMatch = message.toLowerCase().includes(rule.keyword.toLowerCase());
    }

    if (isMatch) {
      // Check idempotency
      const existing = await prisma.facebookAutoDmExecution.findUnique({
        where: { ruleId_commentId: { ruleId: rule.id, commentId } }
      });

      if (existing) continue;

      // Create pending execution
      const execution = await prisma.facebookAutoDmExecution.create({
        data: {
          ruleId: rule.id,
          workspaceId: rule.workspaceId,
          socialAccountId: account.id,
          commentId,
          commenterId,
          commentText: message,
          status: 'PENDING'
        }
      });

      // Send the DM
      try {
        const accessToken = decryptToken(account.token.accessToken);
        await sendFacebookPrivateReply(commentId, rule, accessToken);
        
        await prisma.facebookAutoDmExecution.update({
          where: { id: execution.id },
          data: { status: 'SENT', sentAt: new Date() }
        });
      } catch (err: any) {
        console.error(`[FB Auto DM Error] ${err.message}`);
        await prisma.facebookAutoDmExecution.update({
          where: { id: execution.id },
          data: { status: 'FAILED', error: err.message || 'Unknown error' }
        });
      }

      // Stop processing rules for this comment once one matches
      break; 
    }
  }
}

async function sendFacebookPrivateReply(commentId: string, rule: any, accessToken: string) {
  const url = buildMetaGraphUrl(`/${commentId}/private_replies`);
  
  const payload = {
    message: rule.message
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || `Failed with status ${response.status}`);
  }
}
