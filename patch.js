const fs = require('fs');
let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');

code = code.replace(
  "console.log('[IG_WEBHOOK] COMMENT_RECEIVED');\n  \n  const commenterId = from.id;\n  const mediaId = media.id;",
  "console.log('[IG_WEBHOOK] COMMENT_RECEIVED');\n  \n  const commenterId = from.id;\n  const mediaId = media.id;\n\n  console.log(`[IG_WEBHOOK] ENTRY_ID=${igAccountId}`);\n  console.log(`[IG_WEBHOOK] MEDIA_ID=${mediaId}`);\n  console.log(`[IG_WEBHOOK] COMMENTER_ID=${commenterId}`);"
);

const oldLoop = `  for (const acc of Array.from(candidateAccounts.values())) {
    try {
      const token = decryptToken(acc.token.autoDmAccessToken);
      const res = await fetch(\`https://graph.instagram.com/v21.0/me?access_token=\${encodeURIComponent(token)}\`);
      if (!res.ok) continue;
      
      const data = await res.json();
      if (data.id === igAccountId) {
        console.log('[IG_WEBHOOK] MEDIA_OWNER_RESOLUTION_SUCCESS');
        return acc;
      }
    } catch (e) {
      // Safely ignore errors during token verification
    }
  }

  return null;
}`;

const newLoop = `  for (const acc of Array.from(candidateAccounts.values())) {
    try {
      console.log(\`[IG_WEBHOOK] CANDIDATE_DB_PLATFORM_ACCOUNT_ID=\${acc.platformAccountId}\`);
      const token = decryptToken(acc.token.autoDmAccessToken);
      const res = await fetch(\`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=\${encodeURIComponent(token)}\`);
      if (!res.ok) {
        console.log(\`[IG_WEBHOOK] GRAPH_ME_CALL_FAILED status=\${res.status}\`);
        continue;
      }
      
      const data = await res.json();
      console.log(\`[IG_WEBHOOK] GRAPH_ME_ID=\${data.id}\`);
      if (data.username) {
        console.log(\`[IG_WEBHOOK] GRAPH_ME_USERNAME=\${data.username}\`);
      }

      if (data.id === igAccountId) {
        console.log('[IG_WEBHOOK] MEDIA_OWNER_RESOLUTION_SUCCESS');
        return acc;
      }
    } catch (e: any) {
      console.log(\`[IG_WEBHOOK] CANDIDATE_ERROR=\${e.message}\`);
    }
  }

  return null;
}`;

code = code.replace(oldLoop, newLoop);
fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
