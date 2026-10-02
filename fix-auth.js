const fs = require('fs');
const path = 'lib/auth.ts';
let content = fs.readFileSync(path, 'utf8');

// Remove fallback email
content = content.replace(
  /const targetSuperAdmin = process\.env\.SUPER_ADMIN_EMAIL \|\| 'salmandesigner24@gmail\.com';/g,
  'const targetSuperAdmin = process.env.SUPER_ADMIN_EMAIL;'
);

// We need to guard if !targetSuperAdmin
content = content.replace(
  /if \(user\.email === targetSuperAdmin && user\.systemRole !== 'SUPER_ADMIN'\) \{/g,
  `if (targetSuperAdmin && user.email === targetSuperAdmin && user.systemRole !== 'SUPER_ADMIN') {`
);

// Remove the one-time backfill block completely
const backfillRegex = /\s*\/\/ One-time backfill for salmankhan03312545937@gmail\.com[\s\S]*?notes: 'Backfilled from previous STARTER assignment'\s*\}\s*\);\s*\}\s*\}\s*\}\s*\}/g;
content = content.replace(backfillRegex, '');

fs.writeFileSync(path, content);
console.log('Fixed lib/auth.ts successfully');
