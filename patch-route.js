const fs = require('fs');
const path = 'app/api/instagram-auto-dm/route.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'const { name, socialAccountId, mediaId: mediaId || "ANY", keyword, matchType, message, buttonLabel, destinationUrl, enabled } = body;',
  'const { name, socialAccountId, mediaId, keyword, matchType, message, buttonLabel, destinationUrl, enabled } = body;'
);

fs.writeFileSync(path, code, 'utf8');
console.log('Fixed syntax error');
