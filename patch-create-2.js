const fs = require('fs');

const page = 'app/(dashboard)/instagram-auto-dm/create/page.tsx';
let code = fs.readFileSync(page, 'utf8');

code = code.replace(/accountId/g, "socialAccountId");

fs.writeFileSync(page, code, 'utf8');
console.log('create patched again');
