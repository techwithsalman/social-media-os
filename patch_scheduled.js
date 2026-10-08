const fs = require('fs');

function patchScheduled() {
  let content = fs.readFileSync('app/(dashboard)/scheduled/page.tsx', 'utf-8');
  content = content.replace(/import \{ PlatformIcon \} from '@\/components\/ui\/PlatformIcons';/, "import { PlatformIcon } from '@/components/ui/PlatformIcons';\nimport { MediaThumbnail } from '@/components/ui/MediaThumbnail';");
  
  const oldThumb = `                  <div className="relative w-20 h-20 lg:w-full lg:h-32 rounded-xl bg-[#18181f] overflow-hidden shrink-0 border border-[#33333e] flex items-center justify-center">
                    {displayImageUrl ? (
                      <img src={displayImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : isVideo ? (
                      <div className="flex flex-col items-center gap-2 text-neutral-600">
                        <Play className="w-8 h-8 opacity-50" />
                      </div>
                    ) : (
                      <FileText className="w-8 h-8 text-neutral-600" />
                    )}
                  </div>`;
  
  const newThumb = `                  <MediaThumbnail 
                    mediaAsset={post.mediaAsset || null} 
                    className="relative w-20 h-20 lg:w-full lg:h-32 rounded-xl shrink-0 border border-[#33333e]" 
                    iconClassName="w-8 h-8 opacity-50 text-neutral-600"
                  />`;
  
  content = content.replace(oldThumb, newThumb);
  fs.writeFileSync('app/(dashboard)/scheduled/page.tsx', content);
}

patchScheduled();
