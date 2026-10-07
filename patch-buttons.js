const fs = require('fs');

let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

const replacement = `
  const getAddButtonText = (platId, platName) => {
    switch(platId) {
      case 'INSTAGRAM': return 'Add Instagram Account';
      case 'FACEBOOK': return 'Add Facebook Page';
      case 'TIKTOK': return 'Add TikTok Account';
      case 'YOUTUBE': return 'Add YouTube Channel';
      case 'LINKEDIN': return 'Add LinkedIn Account';
      case 'X': return 'Add X Account';
      case 'SNAPCHAT': return 'Add Snapchat Account';
      default: return \`Add \${platName}\`;
    }
  };
`;

if (!code.includes('getAddButtonText')) {
  code = code.replace('export default function ConnectedAccountsPage', replacement + '\nexport default function ConnectedAccountsPage');
  
  code = code.replace(
    /<span>\{hasAnyConnected \? `Add \$\{plat\.name\}` : 'Connect'\}<\/span>/g,
    "<span>{hasAnyConnected ? getAddButtonText(plat.id, plat.name) : 'Connect'}</span>"
  );
  
  // Also fix the Hero Banner fallback from 0 to ?
  code = code.replace(
    /\{entitlements\?\.limits\?\.maxSocialAccounts \|\| 0\}/g,
    "{entitlements ? (entitlements.limits.maxSocialAccounts === null ? '∞' : entitlements.limits.maxSocialAccounts) : '?'}"
  );
  
  fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
}
