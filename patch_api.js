const fs = require('fs');
let code = fs.readFileSync('app/api/instagram-auto-dm/media/route.ts', 'utf8');

const regex = /if \(!account \|\| !account\.token \|\| !account\.token\.accessToken\) \{\s*return NextResponse\.json\(\{ error: 'Invalid or disconnected account' \}, \{ status: 400 \}\);\s*\}/;

const replacement = `if (!account || !account.token || (!account.token.accessToken && !account.token.autoDmAccessToken)) {
      return NextResponse.json({ error: 'Invalid or disconnected account' }, { status: 400 });
    }`;
code = code.replace(regex, replacement);

const regex2 = /const accessToken = decryptToken\(account\.token\.accessToken\);[\s\S]*?const res = await fetch\(url\);/;
const replacement2 = `let url = '';
    
    if (account.token.autoDmAccessToken) {
      // Use Instagram Login Token
      const token = decryptToken(account.token.autoDmAccessToken);
      url = \`https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&limit=24&access_token=\${encodeURIComponent(token)}\`;
    } else if (account.token.accessToken) {
      // Fallback to Publishing Token
      const token = decryptToken(account.token.accessToken);
      const igUserId = account.platformAccountId;
      url = buildMetaGraphUrl(\`/\${igUserId}/media?fields=id,media_type,media_url,thumbnail_url,caption,timestamp&limit=24&access_token=\${encodeURIComponent(token)}\`);
    } else {
      return NextResponse.json({ error: 'No valid token found' }, { status: 400 });
    }

    const res = await fetch(url);`;
code = code.replace(regex2, replacement2);

fs.writeFileSync('app/api/instagram-auto-dm/media/route.ts', code);
