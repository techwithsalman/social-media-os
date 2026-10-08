const fs = require('fs');
let content = fs.readFileSync('app/api/posts/route.ts', 'utf-8');

const oldBlock = `        if (p.mediaAsset && p.mediaAsset.url) {
          const resolvedUrl = await resolveMediaAccessUrl(p.mediaAsset.url, session.workspaceId);
          return {
            ...p,
            mediaAsset: {
              ...p.mediaAsset,
              url: resolvedUrl,
            },
          };
        }`;

const newBlock = `        if (p.mediaAsset) {
          let resolvedUrl = p.mediaAsset.url;
          if (resolvedUrl) {
            resolvedUrl = await resolveMediaAccessUrl(resolvedUrl, session.workspaceId);
          }
          let resolvedThumbnailUrl = p.mediaAsset.thumbnailUrl;
          if (resolvedThumbnailUrl) {
            resolvedThumbnailUrl = await resolveMediaAccessUrl(resolvedThumbnailUrl, session.workspaceId);
          }
          
          return {
            ...p,
            mediaAsset: {
              ...p.mediaAsset,
              url: resolvedUrl || '',
              thumbnailUrl: resolvedThumbnailUrl,
            },
          };
        }`;

if(content.includes('const resolvedUrl = await resolveMediaAccessUrl(p.mediaAsset.url, session.workspaceId);')) {
   content = content.replace(oldBlock, newBlock);
   fs.writeFileSync('app/api/posts/route.ts', content);
   console.log('Patched');
} else {
   console.log('Not found');
}
