const fs = require('fs');
const path = 'integrations/youtube/index.ts';
let content = fs.readFileSync(path, 'utf8');

const regex1 = /'X-Upload-Content-Type': payload\.mediaType \|\| 'video\/mp4',/m;
const regex2 = /'Content-Type': payload\.mediaType \|\| 'video\/mp4',/m;

const helper = `
function getYouTubeMimeType(payload: any) {
  if (payload.metadata?.mediaMimeType && payload.metadata.mediaMimeType !== 'VIDEO' && payload.metadata.mediaMimeType !== 'IMAGE') {
    return payload.metadata.mediaMimeType;
  }
  
  const filename = (payload.metadata?.mediaFilename || payload.mediaUrl || '').toLowerCase();
  if (filename.includes('.mp4')) return 'video/mp4';
  if (filename.includes('.webm')) return 'video/webm';
  if (filename.includes('.mov')) return 'video/quicktime';
  if (filename.includes('.m4v')) return 'video/x-m4v';
  
  return 'application/octet-stream';
}
`;

if (content.match(regex1) && content.match(regex2)) {
  // Insert helper
  content = content.replace("export class YouTubeAdapter implements ISocialPlatformAdapter {", helper + "\nexport class YouTubeAdapter implements ISocialPlatformAdapter {");
  
  // Replace references
  content = content.replace(/let uploadUrl = payload\.metadata\?\.youtubeUploadUrl;/m, "const resolvedMimeType = getYouTubeMimeType(payload);\n        let uploadUrl = payload.metadata?.youtubeUploadUrl;");
  
  content = content.replace(regex1, `'X-Upload-Content-Type': resolvedMimeType,`);
  content = content.replace(regex2, `'Content-Type': resolvedMimeType,`);
  
  fs.writeFileSync(path, content);
  console.log('Patched youtube adapter successfully');
} else {
  console.log('Could not find regexes in youtube adapter');
}
