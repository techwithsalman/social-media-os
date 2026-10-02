const fs = require('fs');
const path = 'app/tiktok/callback/route.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('getSession')) {
  content = content.replace(
    /import \{ exchangeTikTokCodeForTokens/,
    `import { getSession } from '@/lib/auth';\nimport { exchangeTikTokCodeForTokens`
  );

  content = content.replace(
    /export async function GET\(req: NextRequest\) \{/,
    `export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return redirectToAccounts(req, { error: 'unauthorized', errorDesc: 'You must be logged in.' });
  }
`
  );
  
  content = content.replace(
    /const tokenResult = await exchangeTikTokCodeForTokens\(code, state\);/,
    `const tokenResult = await exchangeTikTokCodeForTokens(code, state);
    if (tokenResult.userId !== session.userId || tokenResult.workspaceId !== session.workspaceId) {
      throw new TikTokOAuthError('OAuth state does not match your current session. Possible CSRF attack prevented.', 'STATE_MISMATCH');
    }`
  );
  
  fs.writeFileSync(path, content);
  console.log('Fixed TikTok OAuth CSRF vulnerability');
} else {
  console.log('TikTok CSRF already fixed');
}
