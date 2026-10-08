const fs = require('fs');
let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');

const regex = /if\s*\(data\.id\s*===\s*igAccountId\)\s*\{\s*console\.log\('\[IG_WEBHOOK\] MEDIA_OWNER_RESOLUTION_SUCCESS'\);\s*return\s*acc;\s*\}/;

const replacement = `if (data.id === igAccountId) {
        console.log('[IG_WEBHOOK] MEDIA_OWNER_RESOLUTION_SUCCESS');
        return acc;
      }

      if (data.username && acc.username && data.username.toLowerCase() === acc.username.toLowerCase()) {
        console.log('[IG_WEBHOOK] ACCOUNT_MATCH_BY_TOKEN_USERNAME=true');
        return acc;
      } else {
        console.log('[IG_WEBHOOK] ACCOUNT_MATCH_BY_TOKEN_USERNAME=false');
      }`;

code = code.replace(regex, replacement);

const regex2 = /console\.log\(\`\[IG_WEBHOOK\] CANDIDATE_DB_PLATFORM_ACCOUNT_ID=\$\{acc\.platformAccountId\}\`\);/;
const replacement2 = `console.log(\`[IG_WEBHOOK] CANDIDATE_DB_PLATFORM_ACCOUNT_ID=\${acc.platformAccountId}\`);
      if (acc.username) {
        console.log(\`[IG_WEBHOOK] CANDIDATE_DB_USERNAME=\${acc.username}\`);
      }`;

code = code.replace(regex2, replacement2);
fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
