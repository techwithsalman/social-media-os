const fs = require('fs');
const path = 'lib/storage/r2.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('Unauthorized access to cross-workspace object')) {
  content = content.replace(
    /objectKey = new URL\(mediaUrl\)\.pathname\.replace\(\/^\/\\\/, ''\);\s*\}\s*catch\s*\{\s*\/\/\s*ignore\s*\}\s*\}/,
    `objectKey = new URL(mediaUrl).pathname.replace(/^\\//, '');
        } catch {
          // ignore
        }
      }

      if (workspaceId && objectKey.startsWith('workspaces/') && !objectKey.startsWith(\`workspaces/\${workspaceId}/\`)) {
        throw new Error('Unauthorized access to cross-workspace object.');
      }`
  );
  fs.writeFileSync(path, content);
  console.log('Patched resolveMediaAccessUrl IDOR');
}
