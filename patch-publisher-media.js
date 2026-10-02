const fs = require('fs');

const path = 'lib/queue/publisher.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /let metadataObj = \{\};\s*try \{\s*if \(pPost\.metadata\) metadataObj = JSON\.parse\(pPost\.metadata\);\s*\} catch \{\s*\/\/ ignore\s*\}/m;

const replacement = `let metadataObj: Record<string, any> = {};
        try {
          if (pPost.metadata) metadataObj = JSON.parse(pPost.metadata);
        } catch {
          // ignore
        }
        
        // Inject exact media size from database to assist resilient uploading
        if (post.mediaAsset) {
          metadataObj.mediaSize = post.mediaAsset.size;
        }`;

if (content.includes('let metadataObj = {};')) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched publisher.ts successfully');
} else {
  console.log('Could not find metadata parsing in publisher.ts');
}
