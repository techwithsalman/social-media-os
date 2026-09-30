const fs = require('fs');
const path = 'lib/queue/publisher.ts';
let code = fs.readFileSync(path, 'utf8');

const regex1 = /console\.log\(`\[QUEUE\] Platform publish started for \$\{pPost\.platform\}`\);/;
const replacement1 = `const isScheduled = !!post.scheduledFor;
        const isMulti = post.platformPosts.length > 1;
        const flowSource = isMulti ? 'MULTI_PLATFORM' : isScheduled ? 'SCHEDULED' : 'POST_NOW';
        if (pPost.platform === 'INSTAGRAM') {
          console.log(\`[INSTAGRAM] Flow source: \${flowSource}\`);
        } else {
          console.log(\`[QUEUE] Platform publish started for \${pPost.platform}\`);
        }`;

code = code.replace(regex1, replacement1);

const regex2 = /console\.log\(`\[RECONCILE\] Checking existing container: \$\{pPost\.externalPostId\}`\);\s*console\.log\(`\[RECONCILE\] Current status: \$\{pPost\.status\}`\);/;
const replacement2 = `console.log(\`[RECONCILE] Existing container: \${pPost.externalPostId}\`);\n          console.log(\`[RECONCILE] Status: \${pPost.status}\`);`;

code = code.replace(regex2, replacement2);

const regex3 = /console\.log\(`\[RECONCILE\] Meta status: \$\{statusData\.status_code \|\| 'UNKNOWN'\}`\);/;
const replacement3 = `console.log(\`[RECONCILE] Status: \${statusData.status_code || 'UNKNOWN'}\`);`;

code = code.replace(regex3, replacement3);

const regex4 = /console\.log\(`\[RECONCILE\] media_publish executed: true`\);\s*const publishUrl =/;
const replacement4 = `const publishUrl =`;

code = code.replace(regex4, replacement4);

const regex5 = /const pubData = await pubRes\.json\(\);\s*if \(pubData\.id\)/;
const replacement5 = `const pubData = await pubRes.json();\n                if (pubData.id) {\n                  console.log(\`[RECONCILE] Final media ID: \${pubData.id}\`);`;

code = code.replace(regex5, replacement5);

fs.writeFileSync(path, code);
console.log('Publisher logs updated.');
