  static async reconcileProcessingPosts(): Promise<void> {
    try {
      // Find PlatformPosts stuck in PROCESSING for more than 1 minute
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const stuckPlatforms = await prisma.platformPost.findMany({
        where: {
          status: 'PROCESSING',
          updatedAt: { lte: oneMinuteAgo },
          externalPostId: { not: null },
        },
        include: {
          socialAccount: { include: { token: true } },
          contentPost: {
            include: {
              platformPosts: true,
            },
          },
        },
      });

      for (const pPost of stuckPlatforms) {
        if (!pPost.externalPostId || pPost.socialAccount.isMock) continue;

        console.log(`\n[RECONCILE] Post ID: ${pPost.contentPostId}`);
        console.log(`[RECONCILE] Platform: ${pPost.platform}`);
        console.log(`[RECONCILE] externalPostId: ${pPost.externalPostId}`);
        console.log(`[RECONCILE] Current status: ${pPost.status}`);

        let newChildStatus = pPost.status;

        if (pPost.platform === 'INSTAGRAM') {
          try {
            const rawToken = pPost.socialAccount.token?.accessToken || '';
            const accessToken = decryptToken(rawToken);

            const statusUrl = `https://graph.instagram.com/v23.0/${pPost.externalPostId}?fields=status_code,status&access_token=${accessToken}`;
            const statusRes = await fetch(statusUrl);
            const statusData = await statusRes.json().catch(() => ({}));

            console.log(`[RECONCILE] Meta status: ${statusData.status_code || 'UNKNOWN'}`);

            if (statusData.status_code === 'FINISHED' || statusData.status_code === 'PUBLISHED') {
              console.log(`[RECONCILE] Action taken: Calling media_publish`);
              const publishUrl = `https://graph.instagram.com/v23.0/${pPost.socialAccount.platformAccountId}/media_publish`;
              const pubRes = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ creation_id: pPost.externalPostId, access_token: accessToken }),
              });
              const pubData = await pubRes.json().catch(() => ({}));

              if (pubRes.ok && pubData.id) {
                newChildStatus = 'PUBLISHED';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'PUBLISHED',
                    externalPostId: pubData.id,
                    externalPostUrl: `https://instagram.com/p/${pubData.id}`,
                    errorMessage: null,
                  },
                });
                console.log(`[RECONCILE] Final DB status: PUBLISHED`);
              } else if (pubData.error?.message?.includes('has already been published')) {
                 newChildStatus = 'PUBLISHED';
                 await prisma.platformPost.update({
                   where: { id: pPost.id },
                   data: { status: 'PUBLISHED', errorMessage: null }
                 });
                 console.log(`[RECONCILE] Final DB status: PUBLISHED (already published)`);
              } else {
                newChildStatus = 'FAILED';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: { status: 'FAILED', errorMessage: pubData.error?.message || 'media_publish failed' },
                });
                console.log(`[RECONCILE] Final DB status: FAILED`);
              }
            } else if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
              console.log(`[RECONCILE] Action taken: Marked FAILED`);
              newChildStatus = 'FAILED';
              await prisma.platformPost.update({
                where: { id: pPost.id },
                data: { status: 'FAILED', errorMessage: 'Instagram video processing failed' },
              });
              console.log(`[RECONCILE] Final DB status: FAILED`);
            } else {
              console.log(`[RECONCILE] Action taken: Still processing, skipping`);
            }
          } catch (err: any) {
            console.error(`[RECONCILE] Error querying Meta API:`, err);
          }
        }

        // If the child status changed, we must re-evaluate the parent ContentPost status
        if (newChildStatus !== pPost.status) {
          // Re-fetch platform posts to get latest statuses
          const updatedPlatformPosts = await prisma.platformPost.findMany({
            where: { contentPostId: pPost.contentPostId },
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

          let finalStatus = pPost.contentPost.status;
          if (publishedCount === updatedPlatformPosts.length && publishedCount > 0) {
            finalStatus = 'PUBLISHED';
          } else if (inboxDraftCount === updatedPlatformPosts.length && inboxDraftCount > 0) {
            finalStatus = 'INBOX_DRAFT';
          } else if (
            publishedCount + inboxDraftCount === updatedPlatformPosts.length &&
            (publishedCount > 0 || inboxDraftCount > 0)
          ) {
            finalStatus = publishedCount > 0 ? 'PUBLISHED' : 'INBOX_DRAFT';
          } else if (failCount === updatedPlatformPosts.length && failCount > 0) {
            finalStatus = 'FAILED';
          } else if (processingCount > 0 && failCount === 0) {
            finalStatus = 'PROCESSING';
          } else if (failCount > 0) {
            finalStatus = 'PARTIALLY_FAILED';
          }

          if (finalStatus !== pPost.contentPost.status) {
            await prisma.contentPost.update({
              where: { id: pPost.contentPostId },
              data: {
                status: finalStatus,
                publishedAt: finalStatus === 'PUBLISHED' ? new Date() : pPost.contentPost.publishedAt,
              },
            });
            console.log(`[RECONCILE] Parent ContentPost ${pPost.contentPostId} updated to ${finalStatus}`);
          }
        }
      }
    } catch (error) {
      console.error('[RECONCILE] Error during reconciliation:', error);
    }
  }
