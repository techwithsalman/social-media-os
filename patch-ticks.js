const fs = require('fs');
let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');

code = code.replace(
  /'Authorization': \\`Bearer \\\$\{accessToken\}\\`/g,
  "`Bearer ${accessToken}`"
);

// I should just replace it cleanly
code = code.replace(
  /'Authorization': \\\`Bearer \\\$\\{accessToken\\}\\\`/g,
  "`Bearer ${accessToken}`"
);

// Also replace simple backslash version
code = code.replace(
  /'Authorization': \\`Bearer \\\${accessToken}\\`/g,
  "`Bearer ${accessToken}`"
);


fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
