const fs = require('fs');
const path = 'app/api/upload/finalize/route.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('Unauthorized object key')) {
  content = content.replace(
    /if \(!objectKey \|\| !filename \|\| !mimeType\) \{\s*return NextResponse\.json\(\{ error: 'Missing required parameters\.' \}, \{ status: 400 \}\);\s*\}/,
    `if (!objectKey || !filename || !mimeType) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    if (!objectKey.startsWith(\`workspaces/\${session.workspaceId}/\`)) {
      return NextResponse.json({ error: 'Unauthorized object key.' }, { status: 403 });
    }`
  );
  fs.writeFileSync(path, content);
  console.log('Patched finalize upload IDOR');
}
