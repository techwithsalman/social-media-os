const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

const helper = `  const openOAuthPopup = (url: string) => {
    const popup = window.open(url, 'oauth_popup', 'width=600,height=700');
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setActionLoadingPlatform(null);
        }
      }, 500);
    }
  };`;

// Insert the helper right after `const fetchAccounts = async () => { ... };` or right before handleConnect
code = code.replace(
  /  const handleConnect = async \(platform: string, intentMode: 'add' \| 'reconnect' = 'add'\) => \{/,
  helper + "\n\n  const handleConnect = async (platform: string, intentMode: 'add' | 'reconnect' = 'add') => {"
);

// Replace the window.open calls
code = code.replace(/window\.open\(([`'][^`']+[`']),\s*'oauth_popup',\s*'width=600,height=700'\)/g, "openOAuthPopup($1)");

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
