const fs = require('fs');
let code = fs.readFileSync('app/api/accounts/route.ts', 'utf8');
if (!code.includes("force-dynamic")) {
  code = "export const dynamic = 'force-dynamic';\n" + code;
  fs.writeFileSync('app/api/accounts/route.ts', code);
}
