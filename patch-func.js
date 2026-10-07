const fs = require('fs');
let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');

const correctBlock = `async function sendInstagramPrivateReply(igAccountId: string, commentId: string, rule: any, accessToken: string) {
  const url = buildMetaGraphUrl(\`/me/messages\`);
  
  const payload: any = {
    recipient: { comment_id: commentId },
    message: { text: rule.message }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${accessToken}\`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const metaError = data.error?.message || 'Unknown Meta error';
    throw new Error(metaError);
  }
}`;

code = code.replace(/async function sendInstagramPrivateReply[\s\S]*?throw new Error\(metaError\);\n  }\n\}/, correctBlock);

fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
