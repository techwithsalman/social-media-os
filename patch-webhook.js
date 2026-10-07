const fs = require('fs');
let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');
code = code.replace(/console\.log\(\[IG Webhook\] Received event at \);\n\n    \/\/ Verify signature if secret is available/g, '');
code = code.replace(/console\.log\(\[IG Webhook\] Processing comment\. Account: , Media: , Comment: \);\n/g, '');

code = code.replace(
  'const signature = req.headers.get(\\'x-hub-signature-256\\');\\n    const secret = process.env.META_APP_SECRET;',
  'const signature = req.headers.get(\\'x-hub-signature-256\\');\\n    const secret = process.env.META_APP_SECRET;\\n\\n    console.log([IG Webhook] Received event at );\\n    console.log([IG Webhook] rawBody preview: );'
);

code = code.replace(
  'const { id: commentId, from, text, media } = value;',
  'const { id: commentId, from, text, media } = value;\\n  console.log([IG Webhook] Processing comment. Account: , Media: , Comment: );'
);

code = code.replace(
  'if (!rules.length) return;',
  'if (!rules.length) { console.log([IG Webhook] No enabled rules found for account  and media ); return; }\\n\\n  console.log([IG Webhook] Found  potential rules for media );'
);

code = code.replace(
  '// Send the DM',
  'console.log([IG Webhook] Rule  matched! Executing...);\\n      // Send the DM'
);

fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
