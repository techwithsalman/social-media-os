const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

const target = '  useEffect(() => {\n    fetchAccounts();\n  }, []);'.replace(/\n/g, '\r\n');

const listenerBlock = `  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
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
        setOauthNotice({ type: 'error', message: 'Connection failed: ' + event.data.error });
        setActionLoadingPlatform(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);`.replace(/\n/g, '\r\n');

if (code.includes(target)) {
  code = code.replace(target, listenerBlock);
  fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
  console.log('Replaced listener successfully');
} else {
  console.log('Target listener not found');
}
