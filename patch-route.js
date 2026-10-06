const fs = require('fs');

const path = 'app/api/instagram-auto-dm/route.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("import { getTarget } from '@/lib/admin-data';\n", "");

fs.writeFileSync(path, code, 'utf8');
console.log('patched');
