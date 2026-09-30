const fs = require('fs');
const path = 'lib/queue/publisher.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/console\.log\(`\[RECONCILE\] Action taken: Still processing, skipping`\);/, 'console.log(`[RECONCILE] media_publish executed: false`);');

fs.writeFileSync(path, code);
console.log('False log added.');
