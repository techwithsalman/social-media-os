import { NextResponse } from 'next/server';

export function createOAuthCallbackResponse(
  platform: string,
  success: boolean,
  errorToken?: string,
  baseUrl: string = 'https://app.techwithsalman.online'
) {
  const targetOrigin = process.env.NODE_ENV === 'production' 
    ? 'https://app.techwithsalman.online' 
    : baseUrl;

  const fallbackUrl = success
    ? `${baseUrl}/accounts?connected=${platform.toLowerCase()}`
    : `${baseUrl}/accounts?meta_error=${errorToken || 'oauth_failed'}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${success ? 'Connection Successful' : 'Connection Failed'}</title>
    </head>
    <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #0e0e12; color: white;">
      <h2 style="margin-bottom: 1rem;">${success ? 'Account Connected Successfully' : 'Connection Failed'}</h2>
      <p style="color: #a1a1aa;">You can safely close this window.</p>
      <script>
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            var bc = new BroadcastChannel('social_oauth_channel');
            bc.postMessage({
              type: '${success ? 'SOCIAL_ACCOUNT_CONNECTED' : 'SOCIAL_ACCOUNT_ERROR'}',
              platform: '${platform}',
              ${!success ? `error: '${errorToken}'` : ''}
            });
            bc.close();
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('social_account_event', JSON.stringify({
              type: '${success ? 'SOCIAL_ACCOUNT_CONNECTED' : 'SOCIAL_ACCOUNT_ERROR'}',
              platform: '${platform}',
              time: Date.now()
            }));
          }
        } catch (err) {}

        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { 
                type: '${success ? 'SOCIAL_ACCOUNT_CONNECTED' : 'SOCIAL_ACCOUNT_ERROR'}', 
                platform: '${platform}',
                ${!success ? `error: '${errorToken}'` : ''}
              }, 
              '*'
            );
            setTimeout(function() { window.close(); }, 350);
          } else {
            window.location.href = '${fallbackUrl}';
          }
        } catch (e) {
          window.location.href = '${fallbackUrl}';
        }
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
