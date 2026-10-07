const fs = require('fs');
let code = fs.readFileSync('app/api/oauth/instagram/connect/route.ts', 'utf8');

code = code.replace(
  /const authorizationUrl = await createInstagramAuthorizationUrl\(session \|\| \{ userId: 'debug', workspaceId: 'debug' \} as any\);/,
  "const mode = (req.nextUrl.searchParams.get('mode') as 'add' | 'reconnect') || 'add';\n    const authorizationUrl = await createInstagramAuthorizationUrl(session || { userId: 'debug', workspaceId: 'debug' } as any, mode);"
);

fs.writeFileSync('app/api/oauth/instagram/connect/route.ts', code);
