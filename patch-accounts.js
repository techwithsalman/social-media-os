const fs = require('fs');
const path = 'app/(dashboard)/accounts/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /if\s*\(platform\s*===\s*'LINKEDIN'\)\s*\{\s*window\.open\('https:\/\/www\.linkedin\.com\/developers\/', '_blank', 'noopener,noreferrer'\);\s*return;\s*\}/,
  "if (platform === 'LINKEDIN') { window.location.href = '/api/oauth/linkedin/connect'; return; }"
);
content = content.replace(
  /\(plat\.id === 'LINKEDIN' \|\| plat\.id === 'X' \|\| plat\.id === 'SNAPCHAT'\)/,
  "(plat.id === 'X' || plat.id === 'SNAPCHAT')"
);

fs.writeFileSync(path, content);
console.log('Patched handleConnect');
