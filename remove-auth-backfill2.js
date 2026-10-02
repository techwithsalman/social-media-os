const fs = require('fs');
const path = 'lib/auth.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /^\s*\/\/ One-time backfill for salmankhan03312545937@gmail\.com[\s\S]*?notes: 'Backfilled from previous STARTER assignment'\s*\}\s*\);\s*\}\s*\}\s*\}\s*\}/m;

content = content.replace(regex, '');

fs.writeFileSync(path, content);
console.log('Restored auth.ts and removed backfill specifically');
