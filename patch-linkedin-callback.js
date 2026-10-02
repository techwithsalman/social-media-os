const fs = require('fs');
const path = 'app/api/oauth/linkedin/callback/route.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('exchangeLinkedInCode(code, state, session)')) {
  content = content.replace(
    /const tokenData = await exchangeLinkedInCode\(code, state\);/,
    "const tokenData = await exchangeLinkedInCode(code, state, session);"
  );
  fs.writeFileSync(path, content);
}
