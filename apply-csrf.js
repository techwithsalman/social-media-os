const fs = require('fs');

function applyCsrf(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('verifyCsrfOrigin')) {
    return;
  }
  
  // Add import
  content = content.replace(
    /import \{ NextRequest, NextResponse \} from 'next\/server';/,
    `import { NextRequest, NextResponse } from 'next/server';\nimport { verifyCsrfOrigin } from '@/lib/csrf';`
  );

  // Add to POST, PATCH, PUT, DELETE
  const methods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  for (const m of methods) {
    const regex = new RegExp(`export async function ${m}\\(req: NextRequest([^)]*)\\) \\{\\s*try \\{`);
    content = content.replace(
      regex,
      `export async function ${m}(req: NextRequest$1) {\n  if (!verifyCsrfOrigin(req)) return NextResponse.json({ error: 'CSRF token missing or invalid' }, { status: 403 });\n  try {`
    );
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Applied CSRF to ${filePath}`);
}

applyCsrf('app/api/posts/[id]/route.ts');
applyCsrf('app/api/posts/[id]/publish/route.ts');
applyCsrf('app/api/super-admin/users/[id]/route.ts');
applyCsrf('app/api/super-admin/maintenance/backfill/route.ts');

