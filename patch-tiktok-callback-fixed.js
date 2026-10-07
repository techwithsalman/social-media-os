const fs = require('fs');
let code = fs.readFileSync('app/tiktok/callback/route.ts', 'utf8');

code = code.replace(
  /function redirectToAccounts\([\s\S]*?params: \{ connected\?: boolean; error\?: string; errorDesc\?: string \}\n\)\s*\{[\s\S]*?return NextResponse\.redirect\(url\);\n\}/,
  `function redirectToAccounts(req: NextRequest, params: { connected?: boolean; error?: string; errorDesc?: string }) {
  return createOAuthCallbackResponse('TIKTOK', !!params.connected, params.error, getBaseUrl(req));
}`
);

fs.writeFileSync('app/tiktok/callback/route.ts', code);
