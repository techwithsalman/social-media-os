const fs = require('fs');

const page = 'app/(dashboard)/instagram-auto-dm/page.tsx';
let code = fs.readFileSync(page, 'utf8');

code = code.replace(/rule\.status/g, "rule.enabled");
code = code.replace(/rule\.enabled === "ACTIVE"/g, "rule.enabled");

fs.writeFileSync(page, code, 'utf8');
console.log('patched rule.enabled');
