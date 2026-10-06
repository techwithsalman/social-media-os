const fs = require('fs');

const path = 'app/api/webhooks/instagram/route.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const url = buildMetaGraphUrl(`/${igAccountId}/messages`);",
  "const url = buildMetaGraphUrl(`/me/messages`);"
);

fs.writeFileSync(path, code, 'utf8');
console.log('patched');
