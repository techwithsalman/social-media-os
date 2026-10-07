const fs = require('fs');
const path = require('path');

const platforms = {
  'instagram': 'INSTAGRAM',
  'meta': 'FACEBOOK',
  'tiktok': 'TIKTOK',
  'youtube': 'YOUTUBE',
  'linkedin': 'LINKEDIN',
  'pinterest': 'PINTEREST',
  'x': 'X'
};

for (const [folder, platformId] of Object.entries(platforms)) {
  const filePath = path.join('app/api/oauth', folder, 'callback/route.ts');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Inject import if needed
    if (!content.includes('createOAuthCallbackResponse')) {
      content = "import { createOAuthCallbackResponse } from '@/lib/oauth-callback';\n" + content;
    }

    // Rewrite redirectToAccounts to use the helper
    // 1. Instagram / Meta / TikTok / YouTube / Pinterest / X
    // Usually it has: function redirectToAccounts(req: NextRequest, code: string)
    // or: function redirectToAccounts(req: NextRequest, success?: boolean, error?: string)

    if (content.includes('function redirectToAccounts(req: NextRequest, code: string) {')) {
      content = content.replace(
        /function redirectToAccounts\(req: NextRequest, code: string\) \{[\s\S]*?return NextResponse\.redirect\(url\);\n\}/,
        `function redirectToAccounts(req: NextRequest, code: string) {\n  return createOAuthCallbackResponse('${platformId}', false, code, getBaseUrl(req));\n}`
      );
    } else if (content.includes('function redirectToAccounts(req: NextRequest, success?: boolean, error?: string) {')) {
      content = content.replace(
        /function redirectToAccounts\(req: NextRequest, success\?: boolean, error\?: string\) \{[\s\S]*?return NextResponse\.redirect\(url\);\n\}/,
        `function redirectToAccounts(req: NextRequest, success?: boolean, error?: string) {\n  return createOAuthCallbackResponse('${platformId}', !!success, error, getBaseUrl(req));\n}`
      );
    } else if (content.includes('function redirectToAccounts(req: NextRequest, errorToken: string) {')) {
      content = content.replace(
        /function redirectToAccounts\(req: NextRequest, errorToken: string\) \{[\s\S]*?return NextResponse\.redirect\(url\);\n\}/,
        `function redirectToAccounts(req: NextRequest, errorToken: string) {\n  return createOAuthCallbackResponse('${platformId}', false, errorToken, getBaseUrl(req));\n}`
      );
    }

    // Replace the success redirects
    content = content.replace(
      /const successUrl = new URL\('[^']+', getBaseUrl\(req\)\);\n\s*return NextResponse\.redirect\(successUrl\);/g,
      `return createOAuthCallbackResponse('${platformId}', true, undefined, getBaseUrl(req));`
    );

    // Some use direct redirects for success
    content = content.replace(
      /return redirectToAccounts\(req, true\);/g,
      `return createOAuthCallbackResponse('${platformId}', true, undefined, getBaseUrl(req));`
    );

    fs.writeFileSync(filePath, content);
  }
}
