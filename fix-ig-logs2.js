const fs = require('fs');
const path = 'integrations/instagram/index.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/console\.log\(`\[INSTAGRAM\] Container created: \$\{container\.data\.id\}`\);\s*console\.log\(`\[INSTAGRAM\] Initial polling budget: 12s`\);/, 'console.log(`[INSTAGRAM] Container ID: ${container.data.id}`);\n        console.log(`[INSTAGRAM] Initial poll budget: 12 seconds`);');

fs.writeFileSync(path, code);
console.log('IG logs updated.');
