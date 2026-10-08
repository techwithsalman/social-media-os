const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/facebook-auto-dm/create/page.tsx', 'utf8');

code = code.replace('const payload = { ...formData };', 'const payload: any = { ...formData };');

fs.writeFileSync('app/(dashboard)/facebook-auto-dm/create/page.tsx', code);
console.log('Fixed type error in create facebook auto dm page');
