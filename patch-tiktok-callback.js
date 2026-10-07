const fs = require('fs');
let code = fs.readFileSync('app/tiktok/callback/route.ts', 'utf8');

if (!code.includes('createOAuthCallbackResponse')) {
  code = "import { createOAuthCallbackResponse } from '@/lib/oauth-callback';\nimport { getBaseUrl } from '@/lib/url';\n" + code;
}

// Fix redirectToAccounts
code = code.replace(
  /function redirectToAccounts\(req: NextRequest, params: \{ connected\?: boolean; error\?: string; errorDesc\?: string \}\) \{[\s\S]*?return NextResponse\.redirect\(url\);\n\}/,
  `function redirectToAccounts(req: NextRequest, params: { connected?: boolean; error?: string; errorDesc?: string }) {
  return createOAuthCallbackResponse('TIKTOK', !!params.connected, params.error, getBaseUrl(req));
}`
);

fs.writeFileSync('app/tiktok/callback/route.ts', code);
