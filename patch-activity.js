const fs = require('fs');

const page = 'app/(dashboard)/instagram-auto-dm/activity/page.tsx';
let code = fs.readFileSync(page, 'utf8');

code = code.replace(/data\.activities/g, "data.executions");

fs.writeFileSync(page, code, 'utf8');
console.log('activity patched');
