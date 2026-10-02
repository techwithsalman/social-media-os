const fs = require('fs');
const path = 'lib/auth.ts';
let content = fs.readFileSync(path, 'utf8');

// The backfill block to remove:
const regex = /\s*\/\/ One-time backfill for salmankhan03312545937@gmail\.com[\s\S]*?notes: 'Backfilled from previous STARTER assignment'\s*\}\s*\);\s*\}\s*\}\s*\}\s*\}/m;

if (content.match(regex)) {
  content = content.replace(regex, '');
  fs.writeFileSync(path, content);
  console.log('Removed backfill from auth.ts');
} else {
  console.log('Could not find backfill in auth.ts');
}
