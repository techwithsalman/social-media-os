const fs = require('fs');
let content = fs.readFileSync('app/(dashboard)/bulk-upload/page.tsx', 'utf-8');
content = content.replace(/catch \(e\) \{/g, "catch (e: any) {");
fs.writeFileSync('app/(dashboard)/bulk-upload/page.tsx', content);
