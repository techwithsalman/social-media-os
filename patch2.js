const fs = require('fs');
let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');

const oldStr = `  for (const acc of Array.from(candidateAccounts.values())) {
    try {
      console.log(\`[IG_WEBHOOK] CANDIDATE_DB_PLATFORM_ACCOUNT_ID=\${acc.platformAccountId}\`);
      const token = decryptToken(acc.token.autoDmAccessToken);
      const res = await 
fetch(\`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=\${encodeURIComponent(token)}\`);
      
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
  }`;

const newStr = `  for (const acc of Array.from(candidateAccounts.values())) {
    try {
      console.log(\`[IG_WEBHOOK] CANDIDATE_DB_PLATFORM_ACCOUNT_ID=\${acc.platformAccountId}\`);
      if (acc.username) {
        console.log(\`[IG_WEBHOOK] CANDIDATE_DB_USERNAME=\${acc.username}\`);
      }
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

      // Check direct ID match first
      if (data.id === igAccountId) {
        console.log('[IG_WEBHOOK] MEDIA_OWNER_RESOLUTION_SUCCESS');
        return acc;
      }

      // Fallback to username matching as requested
      if (data.username && acc.username && data.username.toLowerCase() === acc.username.toLowerCase()) {
        console.log('[IG_WEBHOOK] ACCOUNT_MATCH_BY_TOKEN_USERNAME=true');
        return acc;
      } else {
        console.log('[IG_WEBHOOK] ACCOUNT_MATCH_BY_TOKEN_USERNAME=false');
      }

    } catch (e: any) {
      console.log(\`[IG_WEBHOOK] CANDIDATE_ERROR=\${e.message}\`);
    }
  }`;

code = code.replace(oldStr, newStr);
fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
