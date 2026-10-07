const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

// 1. Add message listener
const listenerBlock = `  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const expectedOrigin = process.env.NODE_ENV === 'production' 
        ? 'https://app.techwithsalman.online' 
        : window.location.origin;
      
      if (event.origin !== expectedOrigin) return;

      if (event.data?.type === 'SOCIAL_ACCOUNT_CONNECTED') {
        fetchAccounts();
        setOauthNotice({ type: 'success', message: 'Account connected successfully.' });
        setActionLoadingPlatform(null);
      } else if (event.data?.type === 'SOCIAL_ACCOUNT_ERROR') {
        const err = event.data.error;
        const msg = messages[err] || 'Connection failed.';
        setOauthNotice({ type: 'error', message: msg });
        setActionLoadingPlatform(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);`;

code = code.replace(/  useEffect\(\(\) => \{\n    fetchAccounts\(\);\n  \}, \[\]\);/, "  useEffect(() => {\n    fetchAccounts();\n  }, []);\n\n" + listenerBlock);

// 2. Change handleConnect to use window.open
function replaceHrefWithOpen(platformCode) {
  const regex = new RegExp(`window\\.location\\.href = \\\`\\/api\\/oauth\\/${platformCode}\\/connect(.*?)\\\`;`, 'g');
  code = code.replace(regex, "window.open(`/api/oauth/" + platformCode + "/connect$1`, 'oauth_popup', 'width=600,height=700');");
}

replaceHrefWithOpen('linkedin');
replaceHrefWithOpen('tiktok');
replaceHrefWithOpen('instagram');
replaceHrefWithOpen('meta');
replaceHrefWithOpen('youtube');
replaceHrefWithOpen('pinterest');

// For linkedin it uses string literal not template
code = code.replace(/window\.location\.href = '\/api\/oauth\/linkedin\/connect';/g, "window.open('/api/oauth/linkedin/connect', 'oauth_popup', 'width=600,height=700');");

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
