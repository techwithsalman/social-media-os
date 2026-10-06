const fs = require('fs');

const path = 'lib/queue/publisher.ts';
let code = fs.readFileSync(path, 'utf8');

const ytRegex = /\} catch \(err: any\) \{\n\s*console\.error\(`\[RECONCILE\] Error querying Meta API:`, err\);\n\s*\}\n\s*\}/;

const newYtCode = `} catch (err: any) {
            console.error(\`[RECONCILE] Error querying Meta API:\`, err);
          }
        } else if (pPost.platform === 'YOUTUBE') {
          try {
            console.log(\`[RECONCILE] Checking YouTube Video \${pPost.externalPostId}...\`);
            const rawToken = pPost.socialAccount.token?.accessToken || '';
            const accessToken = decryptToken(rawToken);
            
            const ytUrl = \`https://youtube.googleapis.com/youtube/v3/videos?part=status,player&id=\${pPost.externalPostId}\`;
            const ytRes = await fetch(ytUrl, { headers: { Authorization: \`Bearer \${accessToken}\` } });
            const ytData = await ytRes.json().catch(() => ({}));

            if (ytRes.ok && ytData.items && ytData.items.length > 0) {
              const video = ytData.items[0];
              const uploadStatus = video.status?.uploadStatus;
              
              console.log(\`[RECONCILE] YouTube uploadStatus: \${uploadStatus}\`);
              
              if (uploadStatus === 'processed' || uploadStatus === 'uploaded') {
                newChildStatus = 'PUBLISHED';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'PUBLISHED',
                    errorMessage: null,
                    externalPostUrl: \`https://www.youtube.com/watch?v=\${pPost.externalPostId}\`
                  }
                });
                console.log(\`[RECONCILE] Final status: PUBLISHED\`);
              } else if (uploadStatus === 'rejected' || uploadStatus === 'failed') {
                newChildStatus = 'FAILED';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'FAILED',
                    errorMessage: \`YouTube processing failed: \${video.status?.failureReason || uploadStatus}\`
                  }
                });
                console.log(\`[RECONCILE] Final status: FAILED\`);
              }
            } else if (!ytRes.ok) {
               console.error('[RECONCILE] YouTube API error:', ytData);
            }
          } catch(err) {
            console.error(\`[RECONCILE] Error querying YouTube API:\`, err);
          }
        }`;

// Replace the ig catch block to inject yt block right after it
code = code.replace(ytRegex, newYtCode);

fs.writeFileSync(path, code, 'utf8');
console.log('publisher.ts patched successfully.');
