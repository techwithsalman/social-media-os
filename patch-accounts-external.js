const fs = require('fs');
const path = 'app/(dashboard)/accounts/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regexX = /if \(platform === 'X'\) \{\s*setActionLoadingPlatform\(platform\);\s*window\.location\.href = `\/api\/oauth\/x\/connect`;\s*return;\s*\}/m;
const regexLinkedIn = /if \(platform === 'LINKEDIN'\) \{\s*setActionLoadingPlatform\(platform\);\s*window\.location\.href = `\/api\/oauth\/linkedin\/connect`;\s*return;\s*\}/m;

// Replace existing X and LINKEDIN logic
if (content.match(regexX)) {
    content = content.replace(regexX, '');
}
if (content.match(regexLinkedIn)) {
    content = content.replace(regexLinkedIn, '');
}

// Add logic for SNAPCHAT, LINKEDIN, X
const handleConnectReplacement = `const handleConnect = async (platform: string) => {
    if (platform === 'LINKEDIN') {
      window.open('https://www.linkedin.com/developers/', '_blank', 'noopener,noreferrer');
      return;
    }
    if (platform === 'X') {
      window.open('https://developer.x.com/', '_blank', 'noopener,noreferrer');
      return;
    }
    if (platform === 'SNAPCHAT') {
      window.open('https://developers.snap.com/', '_blank', 'noopener,noreferrer');
      return;
    }`;

content = content.replace('const handleConnect = async (platform: string) => {', handleConnectReplacement);

fs.writeFileSync(path, content);
console.log('Patched accounts page for external connect links.');
