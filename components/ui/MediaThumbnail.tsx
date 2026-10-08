import React, { useState } from 'react';
import { Play, FileText } from 'lucide-react';

interface MediaThumbnailProps {
  mediaAsset: {
    url?: string;
    thumbnailUrl?: string | null;
    mimeType?: string;
  } | null;
  className?: string;
  iconClassName?: string;
}

export function MediaThumbnail({ mediaAsset, className = "", iconClassName = "w-8 h-8 opacity-50" }: MediaThumbnailProps) {
  const [imageError, setImageError] = useState(false);

  if (!mediaAsset) {
    return (
      <div className={`flex items-center justify-center bg-[#18181f] text-neutral-600 ${className}`}>
        <FileText className={iconClassName} />
      </div>
    );
  }

  const isVideo = mediaAsset.mimeType?.startsWith('video/');
  const hasRealThumbnail = !!mediaAsset.thumbnailUrl && !mediaAsset.thumbnailUrl.includes('.mp4') && !mediaAsset.thumbnailUrl.includes('.mov');
  const hasImageUrl = !!mediaAsset.url && !isVideo;
  
  const displayImageUrl = hasRealThumbnail ? mediaAsset.thumbnailUrl : (hasImageUrl ? mediaAsset.url : null);

  if (displayImageUrl && !imageError) {
    return (
      <div className={`relative flex items-center justify-center bg-[#18181f] overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={displayImageUrl} 
          alt="Media thumbnail" 
          className="w-full h-full object-cover" 
          onError={() => setImageError(true)}
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play className={`text-white fill-white/20 ${iconClassName}`} />
          </div>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={`flex flex-col items-center justify-center bg-[#18181f] text-neutral-500 ${className}`}>
        <Play className={iconClassName} />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-[#18181f] text-neutral-600 ${className}`}>
      <FileText className={iconClassName} />
    </div>
  );
}
