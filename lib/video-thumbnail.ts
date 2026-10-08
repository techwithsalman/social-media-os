export async function generateVideoThumbnail(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      return resolve(null);
    }
    
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    
    let resolved = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    const finish = (result: File | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    video.onloadeddata = () => {
      // Seek to 1 second, or half the video if it's shorter than 2 seconds
      const seekTime = Math.min(1.0, (video.duration || 2) / 2);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 640;
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > MAX_WIDTH) {
          height = Math.floor(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        } else if (width === 0 || height === 0) {
           return finish(null);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        
        ctx.drawImage(video, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            // Fallback extension handling
            const nameParts = file.name.split('.');
            nameParts.pop();
            const baseName = nameParts.join('.') || 'video';
            const thumbFile = new File([blob], baseName + '-thumb.jpg', { type: 'image/jpeg' });
            finish(thumbFile);
          } else {
            finish(null);
          }
        }, 'image/jpeg', 0.8);
      } catch (err) {
        console.error('[THUMBNAIL] Failed to extract video frame', err);
        finish(null);
      }
    };

    video.onerror = () => {
      console.warn('[THUMBNAIL] Video load error', video.error);
      finish(null);
    };
    
    // Safety timeout to prevent hanging the upload process
    setTimeout(() => {
      if (!resolved) {
        console.warn('[THUMBNAIL] Extraction timed out');
        finish(null);
      }
    }, 5000);
  });
}
