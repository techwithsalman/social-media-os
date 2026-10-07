const fs = require('fs');
let code = fs.readFileSync('app/api/oauth/instagram/callback/route.ts', 'utf8');

code = code.replace(
  /const state = searchParams\.get\('state'\);/,
  "const state = searchParams.get('state');\n    const mode = state?.startsWith('reconnect:') ? 'reconnect' : 'add';"
);

code = code.replace(
  /await saveInstagramAccount\(profile, session\);/,
  "await saveInstagramAccount(profile, session, mode as any);"
);

fs.writeFileSync('app/api/oauth/instagram/callback/route.ts', code);
