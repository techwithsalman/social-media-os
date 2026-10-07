import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { decryptToken } from '@/lib/crypto';
import { buildMetaGraphUrl } from '@/lib/meta-token-service';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  console.log([IG_WEBHOOK] GET_VERIFICATION mode= token= challenge=);

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'social_media_os_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  console.log('[IG_WEBHOOK] POST_RECEIVED');
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const secret = process.env.META_APP_SECRET;

    let payload;
    try {
      payload = JSON.parse(rawBody);
      const entryCount = payload.entry?.length || 0;
      console.log([IG_WEBHOOK] object=);
      console.log([IG_WEBHOOK] entries=);
      
      if (entryCount > 0 && payload.entry[0]?.changes?.length > 0) {
        console.log([IG_WEBHOOK] field=);
      }
    } catch (e) {
      console.error('[IG_WEBHOOK] Error parsing JSON');
      return new NextResponse('Invalid JSON', { status: 400 });
    }

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
      for (const change of entry.changes || []) {
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

async function processCommentWebhook(igAccountId: string, value: any) {
  const { id: commentId, from, text, media } = value;
  console.log([Webhook Comment] Account: , MediaID: , CommentID: , TextPresent: );
  const commenterId = from.id;
  const mediaId = media.id;

  // Do not reply to self
  if (commenterId === igAccountId) return;

  // Find social account
  const account = await prisma.socialAccount.findFirst({
    where: { platformAccountId: igAccountId, platform: 'INSTAGRAM' },
    include: { token: true }
  });

  if (!account || !account.token || !account.token.accessToken) return;

  // Find active rules for this media
  const rules = await prisma.instagramAutoDmRule.findMany({
    where: {
      socialAccountId: account.id,
      OR: [{ mediaId: mediaId }, { mediaId: "ANY" }],
      enabled: true
    }
  });

  if (!rules.length) return;

  for (const rule of rules) {
    const isMatch = rule.matchType === 'EXACT'
      ? text.trim().toLowerCase() === rule.keyword.toLowerCase()
      : text.toLowerCase().includes(rule.keyword.toLowerCase());

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
        const accessToken = decryptToken(account.token.accessToken);
        await sendInstagramPrivateReply(igAccountId, commentId, rule, accessToken);
        
        await prisma.instagramAutoDmExecution.update({
          where: { id: execution.id },
          data: { status: 'SENT', sentAt: new Date() }
        });
      } catch (err: any) {
        console.error(`[Auto DM Error] ${err.message}`);
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




