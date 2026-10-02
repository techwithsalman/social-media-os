const fs = require('fs');
const path = 'integrations/youtube/index.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\/ Find total size by making a HEAD request to R2\s*const headRes = await fetch\(payload\.mediaUrl, \{ method: 'HEAD' \}\);\s*totalSize = parseInt\(headRes\.headers\.get\('content-length'\) \|\| '0', 10\);\s*if \(totalSize === 0\) \{\s*return \{ success: false, errorCode: 'MEDIA_ERROR', errorMessage: 'Could not determine media size\.' \};\s*\}/m;

const replacement = `// Find exact total size robustly: DB -> HEAD -> Fallback
          totalSize = payload.metadata?.youtubeUploadTotalSize || payload.metadata?.mediaSize || 0;
          
          if (!totalSize) {
            try {
              const headRes = await fetch(payload.mediaUrl, { method: 'HEAD' });
              totalSize = parseInt(headRes.headers.get('content-length') || '0', 10);
            } catch (err) {
              console.error('[YOUTUBE] HEAD request failed:', err);
            }
          }
          
          if (!totalSize || isNaN(totalSize) || totalSize === 0) {
             console.error('[YOUTUBE] Size resolution failed:', {
               mediaUrl: payload.mediaUrl,
               dbByteSize: payload.metadata?.mediaSize,
               r2ContentLength: totalSize,
               sizeSource: 'Failed'
             });
             return { success: false, errorCode: 'MEDIA_ERROR', errorMessage: 'Could not determine media size.' };
          }`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched youtube adapter successfully');
} else {
  console.log('Could not find chunk in youtube adapter');
}
