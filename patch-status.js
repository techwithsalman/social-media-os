const fs = require('fs');

const path = 'app/api/posts/[id]/refresh-status/route.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Replace the Instagram block
const igRegex = /if \(statusData\.status_code === 'FINISHED' \|\| statusData\.status_code === 'PUBLISHED'\) \{[\s\S]*?\} else if \(statusData\.status_code === 'ERROR' \|\| statusData\.status_code === 'EXPIRED'\) \{/;
const newIgCode = `if (statusData.status_code === 'PUBLISHED') {
              console.log(\`[Refresh Status] Container already PUBLISHED!\`);
              await prisma.platformPost.update({
                where: { id: pPost.id },
                data: {
                  status: 'PUBLISHED',
                  errorMessage: null
                }
              });
            } else if (statusData.status_code === 'FINISHED') {
              console.log(\`[Refresh Status] Container finished! Calling media_publish...\`);
              const publishUrl = \`https://graph.instagram.com/v23.0/\${pPost.socialAccount.platformAccountId}/media_publish\`;
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
                    externalPostUrl: \`https://instagram.com/p/\${pubData.id}\`,
                    errorMessage: null
                  },
                });
              } else {
                const isAlreadyPublished = pubData.error?.message?.toLowerCase().includes('already been published') || pubData.error?.code === 9000 || pubData.error?.error_user_title?.includes('Already Published');
                if (isAlreadyPublished) {
                  console.log(\`[Refresh Status] IG container was already published (caught from error).\`);
                  await prisma.platformPost.update({
                    where: { id: pPost.id },
                    data: {
                      status: 'PUBLISHED',
                      errorMessage: null
                    },
                  });
                } else {
                  await prisma.platformPost.update({
                    where: { id: pPost.id },
                    data: { status: 'FAILED', errorMessage: pubData.error?.message || 'media_publish failed' }
                  });
                }
              }
            } else if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {`;

code = code.replace(igRegex, newIgCode);

// 2. Insert the YouTube block just before the TikTok block
const tkRegex = /if \(pPost\.platform === 'TIKTOK'/;
const ytCode = `if (pPost.platform === 'YOUTUBE' && pPost.status === 'PROCESSING' && pPost.externalPostId && !pPost.socialAccount.isMock) {
          try {
            console.log(\`[Refresh Status] Checking YouTube Video \${pPost.externalPostId}...\`);
            const rawToken = pPost.socialAccount.token?.accessToken || '';
            const accessToken = decryptToken(rawToken);
            
            const ytUrl = \`https://youtube.googleapis.com/youtube/v3/videos?part=status,player&id=\${pPost.externalPostId}\`;
            const ytRes = await fetch(ytUrl, { headers: { Authorization: \`Bearer \${accessToken}\` } });
            const ytData = await ytRes.json().catch(() => ({}));

            if (ytRes.ok && ytData.items && ytData.items.length > 0) {
              const video = ytData.items[0];
              const uploadStatus = video.status?.uploadStatus; // "processed", "uploaded", "rejected", "failed"
              
              console.log(\`[Refresh Status] YouTube uploadStatus: \${uploadStatus}\`);
              
              if (uploadStatus === 'processed' || uploadStatus === 'uploaded') {
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'PUBLISHED',
                    errorMessage: null,
                    externalPostUrl: \`https://www.youtube.com/watch?v=\${pPost.externalPostId}\`
                  }
                });
              } else if (uploadStatus === 'rejected' || uploadStatus === 'failed') {
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'FAILED',
                    errorMessage: \`YouTube processing failed: \${video.status?.failureReason || uploadStatus}\`
                  }
                });
              }
            } else if (!ytRes.ok) {
               console.error('[Refresh Status] YouTube API error:', ytData);
            }
          } catch(err) {
            console.error(err);
          }
        }

        if (pPost.platform === 'TIKTOK'`;

code = code.replace(tkRegex, ytCode);

fs.writeFileSync(path, code, 'utf8');
console.log('Status patched successfully.');
