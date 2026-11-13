/**
 * TikTok Direct Post Video Duration Validation & Metadata Extraction Utilities
 * Enforces official TikTok Content Sharing Guidelines (Point 1 / Direct Post duration restrictions)
 */

export function formatDurationHuman(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '0s';
  const totalSeconds = Math.round(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export interface TikTokDurationValidationOptions {
  mediaFile?: {
    name?: string;
    mimeType?: string;
    duration?: number | null;
  } | null;
  maxVideoPostDurationSec?: number | null;
  creatorUsername?: string | null;
}

/**
 * Validates whether the attached video duration is compliant with the TikTok creator's max_video_post_duration_sec.
 * Returns null if valid, or a descriptive error string if invalid.
 */
export function validateTikTokVideoDuration(options: TikTokDurationValidationOptions): string | null {
  const { mediaFile, maxVideoPostDurationSec, creatorUsername } = options;

  if (!mediaFile) {
    return 'Media is required for TikTok Direct Post. Please attach a video.';
  }

  // If mimeType is present and not a video, let base validation catch non-video files
  if (mediaFile.mimeType && !mediaFile.mimeType.startsWith('video/')) {
    return 'TikTok Direct Post requires a video file (.mp4, .mov, .webm). Image files are not supported.';
  }

  // 1. Check for missing or invalid duration metadata
  if (
    typeof mediaFile.duration !== 'number' ||
    isNaN(mediaFile.duration) ||
    !isFinite(mediaFile.duration) ||
    mediaFile.duration <= 0
  ) {
    return 'Could not verify video duration for TikTok Direct Post. Please re-upload a supported video format (.mp4, .mov, .webm) with valid metadata.';
  }

  // 2. Resolve maximum duration limit (defaults to standard 600s if not specified by creator capability)
  const maxAllowedSec =
    typeof maxVideoPostDurationSec === 'number' && maxVideoPostDurationSec > 0
      ? maxVideoPostDurationSec
      : 600;

  // 3. Compare video duration against max allowed limit
  if (mediaFile.duration > maxAllowedSec) {
    const creatorDisplay = creatorUsername ? `@${creatorUsername}` : 'this creator';
    return `Video duration (${formatDurationHuman(mediaFile.duration)}) exceeds TikTok's maximum allowed limit of ${formatDurationHuman(maxAllowedSec)} for ${creatorDisplay}. Please trim or select a shorter video.`;
  }

  return null;
}

/**
 * Extracts the duration (in seconds) of a video File in the browser using HTMLVideoElement metadata.
 */
export function extractVideoDurationFromFile(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.URL || typeof window.URL.createObjectURL !== 'function') {
      return resolve(null);
    }

    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const blobUrl = URL.createObjectURL(file);
      video.src = blobUrl;

      let settled = false;
      const cleanup = (result: number | null) => {
        if (settled) return;
        settled = true;
        try {
          URL.revokeObjectURL(blobUrl);
          video.removeAttribute('src');
          video.load();
        } catch {}
        resolve(result);
      };

      video.onloadedmetadata = () => {
        const dur = video.duration;
        if (typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0) {
          cleanup(dur);
        } else {
          cleanup(null);
        }
      };

      video.onerror = () => cleanup(null);

      // 6-second timeout failsafe
      setTimeout(() => cleanup(null), 6000);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Extracts the duration (in seconds) of a video from a remote/local URL using HTMLVideoElement metadata.
 */
export function extractVideoDurationFromUrl(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);

    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';
      video.src = url;

      let settled = false;
      const cleanup = (result: number | null) => {
        if (settled) return;
        settled = true;
        try {
          video.removeAttribute('src');
          video.load();
        } catch {}
        resolve(result);
      };

      video.onloadedmetadata = () => {
        const dur = video.duration;
        if (typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0) {
          cleanup(dur);
        } else {
          cleanup(null);
        }
      };

      video.onerror = () => cleanup(null);

      // 6-second timeout failsafe
      setTimeout(() => cleanup(null), 6000);
    } catch {
      resolve(null);
    }
  });
}
