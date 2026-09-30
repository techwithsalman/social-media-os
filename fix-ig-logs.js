const fs = require('fs');
const path = 'integrations/instagram/index.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/console\.log\(`\[IG PUBLISH\] STAGE B: Container creation SUCCESS\. ID: \$\{container\.data\.id\}`\);/, 'console.log(`[INSTAGRAM] Container created: ${container.data.id}`);\n        console.log(`[INSTAGRAM] Initial polling budget: 12s`);');

code = code.replace(/console\.log\(`\[IG PUBLISH\] STAGE C: Container processing FINISHED\. Status: \$\{status\.data\.status_code\}`\);/, 'console.log(`[INSTAGRAM] Status: ${status.data.status_code}`);');

code = code.replace(/console\.log\(`\[IG PUBLISH\] STAGE C: Container still processing after 12s\. Deferring to async status check\.`\);/, 'console.log(`[INSTAGRAM] Status: IN_PROGRESS`);\n          console.log(`[INSTAGRAM] Returning PROCESSING for reconciliation`);');

fs.writeFileSync(path, code);
console.log('IG logs updated.');
