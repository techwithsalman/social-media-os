const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/bulk-upload/page.tsx', 'utf-8');
content = content.replace(/alert\('Failed to save bulk posts'\);/g, "alert(e.message || 'Failed to save bulk posts');");
fs.writeFileSync('app/(dashboard)/bulk-upload/page.tsx', content);
