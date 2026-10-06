const fs = require('fs');

const page = 'app/(dashboard)/instagram-auto-dm/create/page.tsx';
let code = fs.readFileSync(page, 'utf8');

code = code.replace(/accountId:/g, "socialAccountId:");
code = code.replace(/dmMessage:/g, "message:");
code = code.replace(/buttonUrl:/g, "destinationUrl:");

fs.writeFileSync(page, code, 'utf8');
console.log('create patched');
