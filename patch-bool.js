const fs = require('fs');

const page = 'app/(dashboard)/instagram-auto-dm/page.tsx';
let code = fs.readFileSync(page, 'utf8');

code = code.replace(
  /{rule.enabled}/,
  '{rule.enabled ? "ACTIVE" : "PAUSED"}'
);

fs.writeFileSync(page, code, 'utf8');
console.log('patched boolean display');
