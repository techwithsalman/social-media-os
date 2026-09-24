import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { refreshTikTokToken } from '@/lib/tiktok-oauth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = params.id;
    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    // Try finding ContentPost first, or PlatformPost if ID matches
    let contentPost = await prisma.contentPost.findFirst({
      where: {
        id: postId,
        workspaceId: session.workspaceId,
      },
      include: {
        mediaAsset: true,
        platformPosts: {
          include: {
            socialAccount: {
              include: {
                token: true,
              },
            },
          },
        },
      },
    });

    if (!contentPost) {
      // Try searching by platformPost ID
      const platformPost = await prisma.platformPost.findFirst({
        where: { id: postId },
        include: {
          contentPost: {
            include: {
              mediaAsset: true,
              platformPosts: {
                include: {
                  socialAccount: {
                    include: {
                      token: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (platformPost) {
        contentPost = platformPost.contentPost;
      }
    }

    if (!contentPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const tiktokResponses: Record<string, any> = {};

    for (const pPost of contentPost.platformPosts) {
      if (pPost.platform === 'TIKTOK' && pPost.externalPostId && !pPost.socialAccount.isMock) {
        const rawToken = pPost.socialAccount.token?.accessToken || '';
        const rawRefreshToken = pPost.socialAccount.token?.refreshToken || '';
        let decryptedToken = decryptToken(rawToken);
        const decryptedRefreshToken = decryptToken(rawRefreshToken);

        if (decryptedToken) {
          try {
            let statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${decryptedToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ publish_id: pPost.externalPostId }),
            });

            let statusData = await statusRes.json().catch(() => ({}));

            const isAuthError =
              statusRes.status === 401 ||
              statusData.error?.code === 'access_token_invalid' ||
              statusData.error?.code === 'token_expired';

            // Attempt token refresh on HTTP 401 / access_token_invalid only if refresh token is available (at most once)
            if (isAuthError) {
              let refreshedSuccessfully = false;
              if (decryptedRefreshToken) {
                try {
                  console.log(`[Refresh TikTok Status] Attempting token refresh for @${pPost.socialAccount.username}...`);
                  const refreshRes = await refreshTikTokToken(decryptedRefreshToken);
                  if (refreshRes && refreshRes.accessToken) {
                    decryptedToken = refreshRes.accessToken;
                    const newEncryptedAccess = encryptToken(refreshRes.accessToken);
                    const newEncryptedRefresh = refreshRes.refreshToken
                      ? encryptToken(refreshRes.refreshToken)
                      : rawRefreshToken;
                    const newExpiresAt = new Date(Date.now() + (refreshRes.expiresIn || 86400) * 1000);

                    if (pPost.socialAccount.token?.id) {
                      await prisma.oAuthToken.update({
                        where: { id: pPost.socialAccount.token.id },
                        data: {
                          accessToken: newEncryptedAccess,
                          refreshToken: newEncryptedRefresh,
                          expiresAt: newExpiresAt,
                        },
                      });
                    }

                    // Retry status request at most once with refreshed access token
                    statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${decryptedToken}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ publish_id: pPost.externalPostId }),
                    });
                    statusData = await statusRes.json().catch(() => ({}));
                    refreshedSuccessfully = true;
                  }
                } catch (refreshErr: any) {
                  console.error('[Refresh TikTok Status] Token refresh failed:', refreshErr?.message || refreshErr);
                }
              }

              // If refresh was not possible or failed:
              if (!refreshedSuccessfully && (statusRes.status === 401 || statusData.error?.code === 'access_token_invalid' || statusData.error?.code === 'token_expired')) {
                const expiredMsg = 'TikTok connection expired — reconnect required';
                tiktokResponses[pPost.id] = {
                  error: { code: 'connection_expired', message: expiredMsg },
                };

                await prisma.socialAccount.update({
                  where: { id: pPost.socialAccountId },
                  data: { status: 'NEEDS_RECONNECTION' },
                });

                // Preserve INBOX_DRAFT if completed earlier, but update error message to show connection expired
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: pPost.status === 'INBOX_DRAFT' ? 'INBOX_DRAFT' : 'FAILED',
                    errorMessage: expiredMsg,
                  },
                });
                continue;
              }
            }

            tiktokResponses[pPost.id] = statusData;

            if (statusRes.ok && statusData.data) {
              const rawStatus = statusData.data.status || '';
              const publicPostId = statusData.data.public_post_id || statusData.data.video_id;
              const failReason = statusData.data.fail_reason;

              if (rawStatus === 'SUCCESS' || rawStatus === 'PUBLISHED') {
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'PUBLISHED',
                    errorMessage: null,
                    externalPostUrl: publicPostId
                      ? `https://www.tiktok.com/@creator/video/${publicPostId}`
                      : pPost.externalPostUrl || `https://www.tiktok.com/`,
                  },
                });
              } else if (rawStatus === 'FAILED') {
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'FAILED',
                    errorMessage: failReason || 'TikTok publishing failed during processing.',
                  },
                });
              } else if (rawStatus === 'SEND_TO_USER_INBOX') {
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'INBOX_DRAFT',
                    errorMessage: 'Sent to TikTok Creator Inbox (Draft upload)',
                  },
                });
              } else {
                // If the post was already completed as INBOX_DRAFT, NEVER change it back to PROCESSING!
                const isAlreadyInboxDraft = pPost.status === 'INBOX_DRAFT';
                const nextStatus = isAlreadyInboxDraft ? 'INBOX_DRAFT' : 'PROCESSING';
                const statusMessage = isAlreadyInboxDraft
                  ? (pPost.errorMessage || 'Sent to TikTok Creator Inbox (Draft upload)')
                  : `TikTok Status: ${rawStatus}`;

                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: nextStatus,
                    errorMessage: statusMessage,
                  },
                });
              }
            } else if (!statusRes.ok || statusData.error) {
              const apiErrMsg = statusData.error?.message || statusData.error?.code || 'TikTok status request returned an error';
              await prisma.platformPost.update({
                where: { id: pPost.id },
                data: {
                  status: pPost.status === 'INBOX_DRAFT' ? 'INBOX_DRAFT' : 'FAILED',
                  errorMessage: apiErrMsg,
                },
              });
            }
          } catch (err: any) {
            console.error('[Refresh TikTok Status Error]:', err?.message || err);
          }
        }
      }
    }

    // Refresh contentPost status after updating platformPosts
    const updatedPlatformPosts = await prisma.platformPost.findMany({
      where: { contentPostId: contentPost.id },
    });

    let publishedCount = 0;
    let inboxDraftCount = 0;
    let processingCount = 0;
    let failCount = 0;

    for (const p of updatedPlatformPosts) {
      if (p.status === 'PUBLISHED') publishedCount++;
      else if (p.status === 'INBOX_DRAFT') inboxDraftCount++;
      else if (p.status === 'PROCESSING') processingCount++;
      else if (p.status === 'FAILED') failCount++;
    }

    let finalStatus = contentPost.status;
    if (publishedCount === updatedPlatformPosts.length && publishedCount > 0) {
      finalStatus = 'PUBLISHED';
    } else if (inboxDraftCount === updatedPlatformPosts.length && inboxDraftCount > 0) {
      finalStatus = 'INBOX_DRAFT';
    } else if (publishedCount + inboxDraftCount === updatedPlatformPosts.length && (publishedCount > 0 || inboxDraftCount > 0)) {
      finalStatus = publishedCount > 0 ? 'PUBLISHED' : 'INBOX_DRAFT';
    } else if (failCount === updatedPlatformPosts.length && failCount > 0) {
      finalStatus = 'FAILED';
    } else if (processingCount > 0 && failCount === 0) {
      finalStatus = 'PROCESSING';
    } else if (failCount > 0) {
      finalStatus = 'PARTIALLY_FAILED';
    }

    const updatedContentPost = await prisma.contentPost.update({
      where: { id: contentPost.id },
      data: {
        status: finalStatus,
        publishedAt: finalStatus === 'PUBLISHED' ? new Date() : contentPost.publishedAt,
      },
      include: {
        mediaAsset: true,
        platformPosts: {
          include: {
            socialAccount: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      post: updatedContentPost,
      tiktokApiResponses: tiktokResponses,
    });
  } catch (error: any) {
    console.error('[Refresh Post Status Exception]:', error);
    return NextResponse.json({ error: error.message || 'Failed to refresh post status' }, { status: 500 });
  }
}
