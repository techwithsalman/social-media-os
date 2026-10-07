const fs = require('fs');
let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');

code = code.replace(
  /const url = `https:\/\/graph\.instagram\.com\/v21\.0\/\$\{igAccountId\}\/messages`;/,
  'const url = buildMetaGraphUrl(`/me/messages`);'
);

fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
