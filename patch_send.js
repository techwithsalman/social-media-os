const fs = require('fs');
let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');

const regex = /async function sendInstagramPrivateReply\([\s\S]*?throw new Error\(data\?\.error\?\.message \|\| 'Failed to send private reply'\);\n    \}\n\}/;

const replacement = `async function sendInstagramPrivateReply(igAccountId: string, commentId: string, rule: any, accessToken: string) {
    const url = 'https://graph.instagram.com/v21.0/me/messages';
    
    console.log('[IG_WEBHOOK] DM_TOKEN_FIELD=autoDmAccessToken');
    console.log(\`[IG_WEBHOOK] DM_TOKEN_DECRYPTED=\${!!accessToken}\`);
    console.log(\`[IG_WEBHOOK] DM_TOKEN_TYPE=\${typeof accessToken}\`);
    console.log(\`[IG_WEBHOOK] DM_TOKEN_LENGTH=\${accessToken ? accessToken.length : 0}\`);
    console.log(\`[IG_WEBHOOK] DM_TOKEN_HAS_WHITESPACE=\${/\\s/.test(accessToken || '')}\`);
    console.log(\`[IG_WEBHOOK] DM_TOKEN_PREFIX_PRESENT=\${accessToken?.startsWith('Bearer ')}\`);
    console.log(\`[IG_WEBHOOK] DM_SEND_ENDPOINT=\${url}\`);

    const payload: any = {
      recipient: { comment_id: commentId },
      message: { }
    };
  
    if (rule.buttonLabel && rule.destinationUrl) {
      payload.message = {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: rule.message,
            buttons: [
              {
                type: 'web_url',
                url: rule.destinationUrl,
                title: rule.buttonLabel
              }
            ]
          }
        }
      };
    } else {
      payload.message = { text: rule.message };
    }
  
    // Using Authorization header as standard for graph.instagram.com endpoints
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${accessToken}\`
      },
      body: JSON.stringify(payload)
    });
  
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Failed to send private reply');
    }
}`;

code = code.replace(regex, replacement);

fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
