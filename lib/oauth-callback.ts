import { NextResponse } from 'next/server';

export function createOAuthCallbackResponse(
  platform: string,
  success: boolean,
  errorToken?: string,
  baseUrl: string = 'https://app.techwithsalman.online',
  errorDesc?: string
) {
  const isTikTok = platform.toUpperCase() === 'TIKTOK';

  let fallbackUrl: string;
  if (success) {
    fallbackUrl = `${baseUrl}/accounts?connected=${platform.toLowerCase()}`;
  } else if (isTikTok) {
    const params = new URLSearchParams();
    params.set('tiktok_error', errorToken || 'tiktok_oauth_failed');
    if (errorDesc) params.set('tiktok_error_desc', errorDesc);
    fallbackUrl = `${baseUrl}/accounts?${params.toString()}`;
  } else {
    fallbackUrl = `${baseUrl}/accounts?meta_error=${errorToken || 'oauth_failed'}`;
  }

  const safeErrorToken = errorToken ? errorToken.replace(/['"\\<>\n\r]/g, '') : '';
  const safeErrorDesc = errorDesc ? errorDesc.replace(/['"\\<>\n\r]/g, '') : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${success ? 'Connection Successful' : 'Connection Failed'}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0e0e12; color: #ffffff; padding: 24px; box-sizing: border-box; text-align: center;">
      <div style="max-width: 440px; width: 100%; padding: 32px; background-color: #14141b; border: 1px solid ${success ? '#059669' : '#dc2626'}; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="font-size: 40px; margin-bottom: 16px;">${success ? '✅' : '⚠️'}</div>
        <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #ffffff;">
          ${success ? `${platform} Account Connected` : `${platform} Connection Failed`}
        </h2>
        
        ${
          success
            ? `<p style="margin: 0 0 24px; color: #9ca3af; font-size: 14px; line-height: 1.5;">Your account was connected successfully. This window will close shortly.</p>`
            : `<div style="margin: 0 0 24px; padding: 12px 16px; background-color: #261214; border: 1px solid #7f1d1d; border-radius: 12px; text-align: left;">
                 <p style="margin: 0 0 4px; color: #fca5a5; font-size: 13px; font-weight: 600;">Error: ${safeErrorToken || 'oauth_failed'}</p>
                 ${safeErrorDesc ? `<p style="margin: 0; color: #e5e7eb; font-size: 12px; line-height: 1.4;">${safeErrorDesc}</p>` : ''}
               </div>`
        }

        <button onclick="window.close()" style="background-color: ${success ? '#1f2937' : '#dc2626'}; color: #ffffff; border: none; padding: 10px 24px; font-size: 14px; font-weight: 600; border-radius: 10px; cursor: pointer; transition: opacity 0.2s;">
          Close Window
        </button>
      </div>

      <script>
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            var bc = new BroadcastChannel('social_oauth_channel');
            bc.postMessage({
              type: '${success ? 'SOCIAL_ACCOUNT_CONNECTED' : 'SOCIAL_ACCOUNT_ERROR'}',
              platform: '${platform}',
              ${!success ? `error: '${safeErrorToken}', errorDesc: '${safeErrorDesc}'` : ''}
            });
            bc.close();
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('social_account_event', JSON.stringify({
              type: '${success ? 'SOCIAL_ACCOUNT_CONNECTED' : 'SOCIAL_ACCOUNT_ERROR'}',
              platform: '${platform}',
              ${!success ? `error: '${safeErrorToken}', errorDesc: '${safeErrorDesc}',` : ''}
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
                ${!success ? `error: '${safeErrorToken}', errorDesc: '${safeErrorDesc}'` : ''}
              }, 
              '*'
            );
            ${success ? 'setTimeout(function() { window.close(); }, 800);' : ''}
          } else {
            ${success ? `window.location.href = '${fallbackUrl}';` : ''}
          }
        } catch (e) {
          ${success ? `window.location.href = '${fallbackUrl}';` : ''}
        }
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
