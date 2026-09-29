      for (const pPost of contentPost.platformPosts) {
        if (pPost.platform === 'INSTAGRAM' && pPost.status === 'PROCESSING' && pPost.externalPostId && !pPost.socialAccount.isMock) {
          try {
            console.log(`[Refresh Status] Checking IG Container ${pPost.externalPostId}...`);
            const rawToken = pPost.socialAccount.token?.accessToken || '';
            const accessToken = decryptToken(rawToken);
            
            // Check container status
            const statusUrl = `https://graph.instagram.com/v23.0/${pPost.externalPostId}?fields=status_code,status&access_token=${accessToken}`;
            const statusRes = await fetch(statusUrl);
            const statusData = await statusRes.json().catch(() => ({}));
            
            if (statusData.status_code === 'FINISHED' || statusData.status_code === 'PUBLISHED') {
              console.log(`[Refresh Status] Container finished! Calling media_publish...`);
              const publishUrl = `https://graph.instagram.com/v23.0/${pPost.socialAccount.platformAccountId}/media_publish`;
              const pubRes = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ creation_id: pPost.externalPostId, access_token: accessToken }),
              });
              const pubData = await pubRes.json().catch(() => ({}));
              
              if (pubRes.ok && pubData.id) {
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'PUBLISHED',
                    externalPostId: pubData.id,
                    externalPostUrl: `https://instagram.com/p/${pubData.id}`,
                    errorMessage: null
                  },
                });
              } else {
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: { status: 'FAILED', errorMessage: pubData.error?.message || 'media_publish failed' }
                });
              }
            } else if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
              await prisma.platformPost.update({
                where: { id: pPost.id },
                data: { status: 'FAILED', errorMessage: 'Instagram video processing failed' }
              });
            }
          } catch(err) {
            console.error(err);
          }
        }
