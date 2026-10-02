const fs = require('fs');
const path = 'integrations/youtube/index.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /totalSize = parseInt\(headRes\.headers\.get\('content-length'\) \|\| '0', 10\);\s*\} catch \(err\) \{\s*console\.error\('\[YOUTUBE\] HEAD request failed:', err\);\s*\}\s*\}/m;

const replacement = `totalSize = parseInt(headRes.headers.get('content-length') || '0', 10);
            } catch (err) {
              console.error('[YOUTUBE] HEAD request failed:', err);
            }
          }
          
          console.log('[YOUTUBE] total size:', totalSize);`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Added total size log successfully');
} else {
  console.log('Could not find total size block');
}
