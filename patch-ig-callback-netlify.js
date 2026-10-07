const fs = require('fs');
let code = fs.readFileSync('app/api/oauth/instagram/callback/route.ts', 'utf8');

const helper = `function getBaseUrl(req: NextRequest) {
  let host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host || host.includes('.netlify.app')) {
    host = 'app.techwithsalman.online';
  }
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return \`\${protocol}://\${host}\`;
}`;

code = code.replace(
  'function redirectToAccounts(req: NextRequest, code: string) {',
  helper + '\n\nfunction redirectToAccounts(req: NextRequest, code: string) {'
);

code = code.replace(/new URL\('\/accounts', req\.url\)/g, "new URL('/accounts', getBaseUrl(req))");
code = code.replace(/new URL\('\/login', req\.url\)/g, "new URL('/login', getBaseUrl(req))");
code = code.replace(/new URL\('\/accounts\?instagram_connected=1', req\.url\)/g, "new URL('/accounts?instagram_connected=1', getBaseUrl(req))");

fs.writeFileSync('app/api/oauth/instagram/callback/route.ts', code);
