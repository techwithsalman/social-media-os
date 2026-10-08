const fs = require('fs');

let content = fs.readFileSync('app/api/posts/bulk/route.ts', 'utf-8');

content = content.replace(
  /console\.error\('Bulk create post error:', error\);/,
  `console.error('[BULK_POSTS] CREATE_FAILED', error instanceof Error ? error.stack : error);`
);

content = content.replace(
  /const createdPosts = await prisma\.\$transaction\(async \(tx\) => \{/,
  `
    console.log('[BULK_POSTS] REQUEST_RECEIVED', { itemCount: items.length });
    const createdPosts = await prisma.$transaction(async (tx) => {
  `
);

fs.writeFileSync('app/api/posts/bulk/route.ts', content);
