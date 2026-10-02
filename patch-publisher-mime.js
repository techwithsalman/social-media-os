const fs = require('fs');
const path = 'lib/queue/publisher.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /if \(post\.mediaAsset\) \{\s*metadataObj\.mediaSize = post\.mediaAsset\.size;\s*\}/m;

const replacement = `if (post.mediaAsset) {
          metadataObj.mediaSize = post.mediaAsset.size;
          metadataObj.mediaMimeType = post.mediaAsset.mimeType;
          metadataObj.mediaFilename = post.mediaAsset.originalName || post.mediaAsset.filename;
        }`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched publisher.ts successfully');
} else {
  console.log('Could not find metadataObj size injection in publisher.ts');
}
