const fs = require('fs');
const path = 'app/(dashboard)/accounts/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /if\s*\(platform === 'YOUTUBE'\)\s*\{\s*setActionLoadingPlatform\(platform\);\s*window\.location\.href = `\/api\/oauth\/youtube\/connect`;\s*return;\s*\}/;

const replacement = `if (platform === 'YOUTUBE') {
      setActionLoadingPlatform(platform);
      window.location.href = \`/api/oauth/youtube/connect\`;
      return;
    }

    if (platform === 'X') {
      setActionLoadingPlatform(platform);
      window.location.href = \`/api/oauth/x/connect\`;
      return;
    }

    if (platform === 'LINKEDIN') {
      setActionLoadingPlatform(platform);
      window.location.href = \`/api/oauth/linkedin/connect\`;
      return;
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log('Patched accounts page for X and LinkedIn');
