const fs = require('fs');
const path = 'lib/queue/publisher.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/console\.log\(`\\n\[RECONCILE\] Post ID: \$\{pPost\.contentPostId\}`\);\s*console\.log\(`\[RECONCILE\] Platform: \$\{pPost\.platform\}`\);\s*console\.log\(`\[RECONCILE\] externalPostId: \$\{pPost\.externalPostId\}`\);\s*console\.log\(`\[RECONCILE\] Current status: \$\{pPost\.status\}`\);/, 'console.log(`[RECONCILE] Checking existing container: ${pPost.externalPostId}`);');

code = code.replace(/console\.log\(`\[RECONCILE\] Action taken: Calling media_publish`\);/, 'console.log(`[RECONCILE] media_publish executed: true`);');

code = code.replace(/console\.log\(`\[RECONCILE\] Final DB status: PUBLISHED`\);/, 'console.log(`[RECONCILE] Final status: PUBLISHED`);');
code = code.replace(/console\.log\(`\[RECONCILE\] Final DB status: PUBLISHED \(already published\)`\);/, 'console.log(`[RECONCILE] Final status: PUBLISHED`);');

fs.writeFileSync(path, code);
console.log('Publisher logs updated.');
