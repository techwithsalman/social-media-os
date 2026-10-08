const fs = require('fs');

function patchPublished() {
  let content = fs.readFileSync('app/(dashboard)/published/page.tsx', 'utf-8');
  content = content.replace(/import \{ PlatformIcon \} from '@\/components\/ui\/PlatformIcons';/, "import { PlatformIcon } from '@/components/ui/PlatformIcons';\nimport { MediaThumbnail } from '@/components/ui/MediaThumbnail';");
  
  const oldThumb = `                <div className="flex items-start gap-5 min-w-0">
                  <div className="w-24 h-24 rounded-2xl bg-[#18181f] overflow-hidden shrink-0 border border-[#33333e] flex items-center justify-center">
                    {post.mediaAsset?.thumbnailUrl || post.mediaAsset?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.mediaAsset.thumbnailUrl || post.mediaAsset.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-8 h-8 text-neutral-600" />
                    )}
                  </div>`;
  
  const newThumb = `                <div className="flex items-start gap-5 min-w-0">
                  <MediaThumbnail 
                    mediaAsset={post.mediaAsset || null} 
                    className="w-24 h-24 rounded-2xl shrink-0 border border-[#33333e]" 
                    iconClassName="w-8 h-8 opacity-50 text-neutral-600"
                  />`;
  
  content = content.replace(oldThumb, newThumb);
  fs.writeFileSync('app/(dashboard)/published/page.tsx', content);
}

patchPublished();
