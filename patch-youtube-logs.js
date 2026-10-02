const fs = require('fs');
const path = 'integrations/youtube/index.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /const resolvedMimeType = getYouTubeMimeType\(payload\);\s*let uploadUrl = payload\.metadata\?\.youtubeUploadUrl;/m;

const replacement = `const resolvedMimeType = getYouTubeMimeType(payload);
        
        console.log('[YOUTUBE] Diagnostic Upload Info:');
        console.log('[YOUTUBE] media category:', payload.mediaType);
        console.log('[YOUTUBE] stored mime type:', payload.metadata?.mediaMimeType);
        console.log('[YOUTUBE] resolved mime type:', resolvedMimeType);
        console.log('[YOUTUBE] filename:', payload.metadata?.mediaFilename);
        console.log('[YOUTUBE] X-Upload-Content-Type:', resolvedMimeType);
        
        let uploadUrl = payload.metadata?.youtubeUploadUrl;`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Added diagnostic logs successfully');
} else {
  console.log('Could not find injection point for logs');
}
