const fs = require('fs');
const path = 'integrations/youtube/index.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /let totalSize = payload\.metadata\?\.youtubeUploadTotalSize;/m;

const replacement = `let totalSize = payload.metadata?.youtubeUploadTotalSize || payload.metadata?.mediaSize || 0;`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched totalSize declaration successfully');
} else {
  console.log('Could not find totalSize declaration in youtube adapter');
}
