const fs = require('fs');

const path = 'lib/instagram-oauth.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'const appId = process.env.INSTAGRAM_APP_ID?.trim() || process.env.META_APP_ID?.trim();',
  'const appId = process.env.INSTAGRAM_APP_ID?.trim();'
);

code = code.replace(
  'const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();',
  'const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();'
);

code = code.replace(
  'const redirectUri = `${appUrl}/api/oauth/instagram/callback`;',
  'const redirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim() || `${appUrl}/api/oauth/instagram/callback`;'
);

code = code.replace(
  "const authUrl = new URL('https://www.instagram.com/oauth/authorize');",
  "const authUrl = new URL('https://api.instagram.com/oauth/authorize');"
);

fs.writeFileSync(path, code, 'utf8');
console.log('patched');
