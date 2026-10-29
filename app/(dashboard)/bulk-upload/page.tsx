'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import {
  Upload,
  Layers,
  Sparkles,
  Calendar,
  Trash2,
  CheckCircle2,
  Sliders,
  FolderOpen,
  Film,
  X,
  Share2,
  RotateCw,
  AlertCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { zonedDateTimeToUtcIso, WORKSPACE_TIMEZONE } from '@/lib/timezone';
import { SUPPORTED_PLATFORM_IDS } from '@/lib/platforms';

interface SocialAccount {
  id: string;
  platform: string;
  name: string;
  username: string;
  status: string;
}

interface BulkItem {
  id: string;
  mediaAssetId?: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  mimeType: string;
  caption: string;
  scheduledDate: string;
  scheduledTime: string;
  selectedAccountIds: string[];
  status: 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'ERROR';
  progress?: number;
  errorMessage?: string;
  isSharedReused?: boolean;
}

interface LibraryMediaAsset {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  playbackUrl?: string;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
}

const MAX_CONCURRENT_UPLOADS = 2; // Optimal concurrency for video bandwidth and socket stability

export default function BulkUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File and Concurrency Queue Refs (persists across re-renders without dropping File references)
  const fileMapRef = useRef<Map<string, File>>(new Map());
  const uploadQueueRef = useRef<string[]>([]);
  const activeUploadsRef = useRef<number>(0);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [items, setItems] = useState<BulkItem[]>([]);
  const [bulkMasterCaption, setBulkMasterCaption] = useState('');
  const [applyToAllVideos, setApplyToAllVideos] = useState(true);

  const [postsPerDay, setPostsPerDay] = useState(3);
  const defaultTimeSlotsForCount = (count: number) => {
    switch (count) {
      case 1:
        return ['09:00'];
      case 2:
        return ['09:00', '15:00'];
      case 3:
        return ['09:00', '12:00', '15:00'];
      case 4:
        return ['09:00', '12:00', '15:00', '18:00'];
      case 5:
        return ['09:00', '11:00', '13:00', '15:00', '18:00'];
      case 6:
        return ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
      default:
        return Array.from({ length: count }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
    }
  };

  const handlePostsPerDayChange = (newCount: number) => {
    setPostsPerDay(newCount);
    setTimeSlots((prev) => {
      const defaults = defaultTimeSlotsForCount(newCount);
      const newSlots = [];
      for (let i = 0; i < newCount; i++) {
        newSlots.push(prev[i] || defaults[i] || '12:00');
      }
      return newSlots;
    });
    setScheduleGenerated(false);
  };

  const [startDate, setStartDate] = useState('');
  const [timeSlots, setTimeSlots] = useState(['09:00', '12:00', '15:00', '18:00', '21:00']);
  const [timezone, setTimezone] = useState(WORKSPACE_TIMEZONE);

  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState<string>("");
  const [successBanner, setSuccessBanner] = useState(false);
  const [scheduleGenerated, setScheduleGenerated] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Media Library Modal state
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<LibraryMediaAsset[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoadingAccounts(true);
        const res = await fetch('/api/accounts');
        if (res.ok) {
          const data = await res.json();
          const fetchedAccounts = (data.accounts || []).filter(
            (a: any) =>
              a.status === 'CONNECTED' &&
              a.platform !== 'FACEBOOK_PROFILE' &&
              (SUPPORTED_PLATFORM_IDS as readonly string[]).includes(a.platform)
          );
          setAccounts(fetchedAccounts);
          setSelectedAccountIds(fetchedAccounts.map((a: any) => a.id));
        }
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setStartDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Upload Single File using Presigned URL -> Direct Cloudflare R2 PUT -> Finalize
  const runSingleUpload = useCallback(async (itemId: string, file: File) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, status: 'UPLOADING', progress: 0, errorMessage: undefined }
          : i
      )
    );

    try {
      // Step 1: Request Presigned Upload URL & Deduplication Check
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'video/mp4',
          size: file.size,
        }),
      });

      const presignedData = await presignedRes.json();
      if (!presignedRes.ok) {
        throw new Error(presignedData.error || `Upload authorization failed (HTTP ${presignedRes.status})`);
      }

      // Single-Object Storage Deduplication:
      // If asset already exists in Cloudflare R2, reuse it immediately without uploading again!
      if (presignedData.alreadyExists && presignedData.media) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  status: 'UPLOADED',
                  mediaAssetId: presignedData.media.id,
                  url: presignedData.media.url,
                  thumbnailUrl: presignedData.media.thumbnailUrl || undefined,
                  progress: 100,
                  isSharedReused: true,
                  errorMessage: undefined,
                }
              : i
          )
        );
        return;
      }

      if (!presignedData.uploadUrl) {
        throw new Error('Presigned upload URL was not generated by server.');
      }

      // Step 2: Direct HTTP PUT to Cloudflare R2 with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedData.uploadUrl);
        xhr.timeout = 300000; // 5-minute timeout per video

        if (file.type) {
          xhr.setRequestHeader('Content-Type', file.type);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
            setItems((prev) =>
              prev.map((i) => (i.id === itemId ? { ...i, progress: percent } : i))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(`Cloudflare R2 returned HTTP ${xhr.status} ${xhr.statusText || ''}`.trim())
            );
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error uploading to Cloudflare R2. Check your connection.'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Upload timed out. Connection was too slow.'));
        };

        xhr.onabort = () => {
          reject(new Error('Upload was aborted.'));
        };

        xhr.send(file);
      });

      // Step 3: Finalize Media Asset record in PostgreSQL
      const finalizeRes = await fetch('/api/upload/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectKey: presignedData.objectKey,
          filename: file.name,
          mimeType: file.type || 'video/mp4',
          size: file.size,
        }),
      });

      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) {
        throw new Error(finalizeData.error || `Media finalization failed (HTTP ${finalizeRes.status})`);
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: 'UPLOADED',
                mediaAssetId: finalizeData.media.id,
                url: finalizeData.media.url,
                thumbnailUrl: finalizeData.media.thumbnailUrl || undefined,
                progress: 100,
                isSharedReused: false,
                errorMessage: undefined,
              }
            : i
        )
      );
    } catch (err: any) {
      console.error(`[Upload Failed] ${file.name}:`, err);
      const message = err?.message || 'Upload failed. Click Retry.';
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: 'ERROR',
                errorMessage: message,
              }
            : i
        )
      );
    }
  }, []);

  // Controlled Concurrency Queue Worker
  const processUploadQueue = useCallback(async () => {
    while (
      activeUploadsRef.current < MAX_CONCURRENT_UPLOADS &&
      uploadQueueRef.current.length > 0
    ) {
      const nextId = uploadQueueRef.current.shift();
      if (!nextId) break;

      const file = fileMapRef.current.get(nextId);
      if (!file) continue;

      activeUploadsRef.current++;
      runSingleUpload(nextId, file).finally(() => {
        activeUploadsRef.current--;
        processUploadQueue();
      });
    }
  }, [runSingleUpload]);

  // Batch Upload from local file picker
  const handleBatchUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const newItems: BulkItem[] = [];
    const newIds: string[] = [];

    filesArray.forEach((file, idx) => {
      const id = `bulk_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      fileMapRef.current.set(id, file);
      newIds.push(id);

      newItems.push({
        id,
        name: file.name,
        url: '',
        size: file.size,
        mimeType: file.type || 'video/mp4',
        caption: bulkMasterCaption || file.name.replace(/\.[^/.]+$/, ''),
        scheduledDate: startDate,
        scheduledTime: '12:00',
        selectedAccountIds: [...selectedAccountIds],
        status: 'PENDING',
        progress: 0,
      });
    });

    setItems((prev) => [...prev, ...newItems]);
    setScheduleGenerated(false);

    // Enqueue items into concurrency queue
    uploadQueueRef.current.push(...newIds);
    processUploadQueue();
  };

  // Retry an individual failed item
  const handleRetryItem = (itemId: string) => {
    const file = fileMapRef.current.get(itemId);
    if (!file) {
      alert('File reference is no longer in memory. Please re-select the file from your computer.');
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, status: 'PENDING', progress: 0, errorMessage: undefined }
          : i
      )
    );

    uploadQueueRef.current.push(itemId);
    processUploadQueue();
  };

  // Retry all failed items
  const handleRetryAllFailed = () => {
    const failedItems = items.filter(
      (i) => i.status === 'ERROR' && fileMapRef.current.has(i.id)
    );
    if (failedItems.length === 0) return;

    const failedIds = failedItems.map((i) => i.id);

    setItems((prev) =>
      prev.map((i) =>
        failedIds.includes(i.id)
          ? { ...i, status: 'PENDING', progress: 0, errorMessage: undefined }
          : i
      )
    );

    uploadQueueRef.current.push(...failedIds);
    processUploadQueue();
  };

  // Clear all failed items from queue
  const handleClearFailed = () => {
    const failedIds = new Set(items.filter((i) => i.status === 'ERROR').map((i) => i.id));
    failedIds.forEach((id) => fileMapRef.current.delete(id));
    uploadQueueRef.current = uploadQueueRef.current.filter((id) => !failedIds.has(id));
    setItems((prev) => prev.filter((i) => !failedIds.has(i.id)));
  };

  // Remove single item
  const handleRemoveItem = (itemId: string) => {
    fileMapRef.current.delete(itemId);
    uploadQueueRef.current = uploadQueueRef.current.filter((id) => id !== itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const openLibraryModal = async () => {
    setShowLibraryModal(true);
    setSelectedLibraryIds([]);
    try {
      setLoadingLibrary(true);
      const res = await fetch('/api/upload?type=video&limit=100');
      if (res.ok) {
        const data = await res.json();
        setLibraryAssets(data.mediaAssets || []);
      }
    } catch (err) {
      console.error('Failed to load media library:', err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleAddFromLibrary = () => {
    const selectedAssets = libraryAssets.filter((a) => selectedLibraryIds.includes(a.id));
    if (selectedAssets.length === 0) return;

    const newItems: BulkItem[] = selectedAssets.map((asset, idx) => ({
      id: `lib_${asset.id}_${Date.now()}_${idx}`,
      mediaAssetId: asset.id,
      name: asset.originalName || asset.filename,
      url: asset.playbackUrl || asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      size: asset.size,
      mimeType: asset.mimeType,
      caption: bulkMasterCaption || asset.originalName || `Video #${items.length + idx + 1}`,
      scheduledDate: startDate,
      scheduledTime: '12:00',
      selectedAccountIds: [...selectedAccountIds],
      status: 'UPLOADED',
      progress: 100,
      isSharedReused: true,
    }));

    setItems((prev) => [...prev, ...newItems]);
    setShowLibraryModal(false);
    setScheduleGenerated(false);
  };

  const handleApplyBulkCaption = () => {
    if (!bulkMasterCaption) return;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        caption: bulkMasterCaption,
      }))
    );
  };

  const handleGenerateSchedule = () => {
    setGenerateError('');
    if (items.length === 0) {
      setGenerateError('Upload or select at least one media file.');
      return;
    }
    if (selectedAccountIds.length === 0) {
      setGenerateError('Select at least one social account (e.g. YouTube channel Beyond History).');
      return;
    }
    if (!startDate) {
      setGenerateError('Choose a starting date.');
      return;
    }
    if (timeSlots.slice(0, postsPerDay).some((t) => !t)) {
      setGenerateError(`Set all ${postsPerDay} posting times.`);
      return;
    }

    const uploadedCount = items.filter((i) => i.status === 'UPLOADED').length;
    if (uploadedCount === 0) {
      const isUploading = items.some((i) => i.status === 'UPLOADING' || i.status === 'PENDING');
      if (isUploading) {
        setGenerateError('Uploads are currently in progress. Please wait until at least one video finishes uploading.');
      } else {
        setGenerateError('No successfully uploaded videos in queue. Please retry failed uploads before generating schedule matrix.');
      }
      return;
    }

    const slotsToUse = timeSlots.slice(0, postsPerDay);
    const parts = startDate.split('-');
    const yyyyStart = parseInt(parts[0], 10);
    const mmStart = parseInt(parts[1], 10) - 1;
    const ddStart = parseInt(parts[2], 10);

    let scheduleSlotIndex = 0;

    setItems((prev) =>
      prev.map((item) => {
        const dayOffset = Math.floor(scheduleSlotIndex / postsPerDay);
        const slotIdx = scheduleSlotIndex % postsPerDay;
        const targetDate = new Date(yyyyStart, mmStart, ddStart);
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');

        if (item.status === 'UPLOADED') {
          scheduleSlotIndex++;
        }

        return {
          ...item,
          scheduledDate: `${yyyy}-${mm}-${dd}`,
          scheduledTime: slotsToUse[slotIdx],
          selectedAccountIds: applyToAllVideos ? [...selectedAccountIds] : item.selectedAccountIds,
        };
      })
    );
    setScheduleGenerated(true);
  };

  const handleSaveAllBulk = async () => {
    const isUploading = items.some((i) => i.status === 'UPLOADING' || i.status === 'PENDING');
    if (isUploading) {
      alert('Please wait for active uploads to finish before scheduling.');
      return;
    }

    const uploadedItems = items.filter((i) => i.status === 'UPLOADED');
    if (uploadedItems.length === 0) {
      alert('No uploaded videos are ready to be scheduled.');
      return;
    }

    const failedCount = items.filter((i) => i.status === 'ERROR').length;
    if (failedCount > 0) {
      const proceed = confirm(
        `${failedCount} video(s) failed upload and cannot be scheduled.\n\nDo you want to proceed with scheduling only the ${uploadedItems.length} successfully uploaded video(s)?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    setSavingStatus('Preparing schedule batch...');
    try {
      const payloadItems = uploadedItems.map((item) => {
        const utcIso = zonedDateTimeToUtcIso(item.scheduledDate, item.scheduledTime, timezone);

        const platformSettings = accounts
          .filter((a) => item.selectedAccountIds.includes(a.id))
          .map((a) => ({
            socialAccountId: a.id,
            platform: a.platform,
            customCaption: item.caption,
            contentType: item.mimeType.startsWith('video') ? 'VIDEO' : 'POST',
            visibility: 'PUBLIC',
          }));

        return {
          mediaAssetId: item.mediaAssetId,
          masterCaption: item.caption,
          scheduledFor: utcIso,
          timezone,
          platformSettings,
        };
      });

      // Client-side sub-batching: send in bounded batches of 25 items to prevent serverless timeouts
      const CLIENT_BATCH_SIZE = 25;
      let totalScheduledCount = 0;
      let totalFailedCount = 0;
      const allFailedItems: any[] = [];

      for (let i = 0; i < payloadItems.length; i += CLIENT_BATCH_SIZE) {
        const batch = payloadItems.slice(i, i + CLIENT_BATCH_SIZE);
        const batchNum = Math.floor(i / CLIENT_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(payloadItems.length / CLIENT_BATCH_SIZE);
        setSavingStatus(`Scheduling batch ${batchNum} of ${totalBatches}...`);

        const res = await fetch('/api/posts/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch }),
        });

        // Safe response parsing: handle HTML error responses (504, 502, 500) gracefully
        const contentType = res.headers.get('content-type') || '';
        let data: any = null;
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          const cleanSnippet = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
          throw new Error(
            `Server returned HTTP ${res.status} (${res.statusText || 'Error'}): ${cleanSnippet || 'Non-JSON response'}`
          );
        }

        if (!res.ok) {
          throw new Error(data?.error || `Failed to schedule batch ${batchNum}`);
        }

        totalScheduledCount += data.scheduledCount || 0;
        totalFailedCount += data.failedCount || 0;
        if (data.failedItems && Array.isArray(data.failedItems)) {
          allFailedItems.push(...data.failedItems);
        }
      }

      if (totalScheduledCount === payloadItems.length) {
        // 100% verified complete success
        setSavingStatus('All posts scheduled successfully!');
        setSuccessBanner(true);
        setTimeout(() => {
          router.push('/calendar');
        }, 1500);
      } else if (totalScheduledCount > 0 && totalFailedCount > 0) {
        // Partial success: keep failed items in queue so user can retry, clear successful ones
        const failedAssetIds = new Set(allFailedItems.map((f: any) => f.mediaAssetId));
        setItems((prev) =>
          prev
            .filter((item) => failedAssetIds.has(item.mediaAssetId))
            .map((item) => {
              const errObj = allFailedItems.find((f: any) => f.mediaAssetId === item.mediaAssetId);
              return {
                ...item,
                status: 'ERROR',
                errorMessage: errObj?.error || 'Scheduling failed on server',
              };
            })
        );
        alert(
          `Partial Completion: ${totalScheduledCount} of ${payloadItems.length} posts were scheduled successfully to your Content Calendar.\n\n${totalFailedCount} items encountered errors and remain in the queue for retry.`
        );
      } else {
        throw new Error(allFailedItems[0]?.error || 'Failed to schedule posts');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save bulk posts');
    } finally {
      setSaving(false);
      setSavingStatus('');
    }
  };

    // Queue Statistics
  const uploadedCount = items.filter((i) => i.status === 'UPLOADED').length;
  const uploadingCount = items.filter((i) => i.status === 'UPLOADING').length;
  const pendingCount = items.filter((i) => i.status === 'PENDING').length;
  const errorCount = items.filter((i) => i.status === 'ERROR').length;
  const totalCount = items.length;
  const overallProgress = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

  return (
    <AppLayout title="Bulk Upload & Automatic Schedule Generator">
      <div className="max-w-[1440px] w-full mx-auto">
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Batch Media Uploader & Schedule Matrix
              </h1>
              <p className="text-sm md:text-base text-neutral-400 mt-1.5">
                Upload 50–100 videos with controlled concurrency, real-time progress, and single-object Cloudflare R2 deduplication.
              </p>
            </div>
            {/* Shared R2 Architecture Badge */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-950/40 border border-red-500/30 text-xs font-bold text-red-300">
              <Share2 className="w-4 h-4 text-red-400 shrink-0" />
              <span>Single-Object R2: 1 Video Original → Multiple Platforms</span>
            </div>
          </div>
        </div>

        {successBanner && (
          <div className="mb-8 p-5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-sm font-semibold flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Batch schedule created successfully! Redirecting to Content Calendar...</span>
          </div>
        )}

        {/* Grid: Matrix Settings & Upload Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Left: Schedule Matrix Generator (1 Col) */}
          <div className="bg-[#0e0e12] border border-[#22222a] rounded-3xl p-6 md:p-8 shadow-md space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#22222a]">
              <Sliders className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Automatic Matrix Config
              </h3>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-1.5">
                Posts Per Day
              </label>
              <select
                value={postsPerDay}
                onChange={(e) => handlePostsPerDayChange(parseInt(e.target.value, 10))}
                className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white"
              >
                <option value="1">1 Post / Day</option>
                <option value="2">2 Posts / Day</option>
                <option value="3">3 Posts / Day</option>
                <option value="4">4 Posts / Day</option>
                <option value="5">5 Posts / Day</option>
                <option value="6">6 Posts / Day</option>
              </select>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-1.5">
                Starting Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setScheduleGenerated(false);
                }}
                className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white"
              />
            </div>

            <div>
              <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-1.5">
                Posting Times
              </label>
              <div className="space-y-2">
                {timeSlots.slice(0, postsPerDay).map((time, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-6 text-xs text-neutral-500 font-bold text-right">{idx + 1}.</div>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => {
                        const newSlots = [...timeSlots];
                        newSlots[idx] = e.target.value;
                        setTimeSlots(newSlots);
                        setScheduleGenerated(false);
                      }}
                      className="flex-1 p-2 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-1.5">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setScheduleGenerated(false);
                }}
                className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white"
              >
                <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-2.5">
                Target Networks
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto">
                {loadingAccounts ? (
                  <span className="text-neutral-500 text-sm">Loading...</span>
                ) : accounts.length === 0 ? (
                  <span className="text-neutral-500 text-sm">No accounts connected</span>
                ) : (
                  accounts.map((acc) => {
                    const isChecked = selectedAccountIds.includes(acc.id);
                    return (
                      <label
                        key={acc.id}
                        title={`${acc.name || acc.username}${
                          acc.username && acc.username !== acc.name ? ` (${acc.username})` : ''
                        }`}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs md:text-sm font-semibold cursor-pointer ${
                          isChecked
                            ? 'bg-red-950/40 border-red-500/50 text-white'
                            : 'bg-[#0e0e12]/40 border-[#22222a] text-neutral-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedAccountIds((prev) =>
                              prev.includes(acc.id)
                                ? prev.filter((p) => p !== acc.id)
                                : [...prev, acc.id]
                            );
                            setScheduleGenerated(false);
                          }}
                          className="rounded border-[#33333e] bg-[#0e0e12] text-red-600 w-4 h-4"
                        />
                        <PlatformIcon platform={acc.platform} size={16} className="w-4 h-4 rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-bold text-white text-xs">
                              {acc.name || acc.username}
                            </span>
                            {acc.platform === 'FACEBOOK' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                                Page
                              </span>
                            )}
                          </div>
                          {acc.username && acc.username !== acc.name && (
                            <span className="text-[10px] text-neutral-400 truncate block font-mono">
                              {/^\d+$/.test(acc.username) ? `ID: ${acc.username}` : `@${acc.username}`}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {generateError && (
              <div className="text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{generateError}</span>
              </div>
            )}

            <button
              onClick={handleGenerateSchedule}
              className="w-full mt-3 py-3 px-5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-md shadow-red-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Schedule Matrix</span>
            </button>
          </div>

          {/* Right: Master Caption & Multi-Dropzone (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0e0e12] border border-[#22222a] rounded-3xl p-6 md:p-8 shadow-md">
              <h3 className="text-sm md:text-base font-bold text-white uppercase tracking-wider mb-3">
                Bulk Master Caption
              </h3>
              <textarea
                rows={4}
                value={bulkMasterCaption}
                onChange={(e) => setBulkMasterCaption(e.target.value)}
                placeholder="Enter master caption to apply across all uploaded items in this batch..."
                className="w-full p-4 text-sm md:text-base bg-[#0e0e12] border border-[#22222a] rounded-2xl text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500 leading-relaxed"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-[#22222a]">
                <label className="flex items-center gap-3 text-sm font-semibold text-neutral-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllVideos}
                    onChange={(e) => setApplyToAllVideos(e.target.checked)}
                    className="rounded-md border-[#33333e] bg-[#0e0e12] text-red-600 w-4 h-4"
                  />
                  <span>Apply caption & networks to all items</span>
                </label>

                <button
                  onClick={handleApplyBulkCaption}
                  className="px-4 py-2 rounded-xl bg-[#18181f] hover:bg-[#2a1010] text-sm font-bold text-red-400 border border-[#33333e] transition-colors"
                >
                  Apply to List
                </button>
              </div>
            </div>

            {/* Action Bar: Upload Files OR Select from Media Library */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Multi-Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-red-500/30 hover:border-red-500/80 rounded-[28px] p-8 text-center bg-[#0c0c10] hover:bg-[#121216] transition-all group shadow-inner"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => {
                    handleBatchUpload(e.target.files);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm md:text-base font-bold text-white">
                  Upload New Files
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Upload MP4/MOV videos with controlled concurrency
                </p>
              </div>

              {/* Select From Existing Media Library */}
              <div
                onClick={openLibraryModal}
                className="cursor-pointer border-2 border-dashed border-[#2a2a36] hover:border-red-500/60 rounded-[28px] p-8 text-center bg-[#0c0c10] hover:bg-[#121216] transition-all group shadow-inner"
              >
                <div className="w-12 h-12 rounded-2xl bg-neutral-800 text-neutral-300 group-hover:bg-red-500/10 group-hover:text-red-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <p className="text-sm md:text-base font-bold text-white">
                  Select from Media Library
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Reuse already uploaded R2 media
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Generated Content Batch List */}
        <div className="bg-[#0e0e12] border border-[#22222a] rounded-3xl p-6 md:p-8 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-[#22222a] gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-red-500" />
                <h3 className="text-lg md:text-xl font-bold text-white">
                  Queued Content Items ({items.length})
                </h3>
              </div>
              {scheduleGenerated && uploadedCount > 0 && (
                <div className="text-sm font-semibold text-neutral-400">
                  {uploadedCount} videos ready • {postsPerDay} posts/day • {Math.ceil(uploadedCount / postsPerDay)} publishing days<br />
                  Starts {items[0]?.scheduledDate} • Timezone: {timezone}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {errorCount > 0 && (
                <>
                  <button
                    onClick={handleRetryAllFailed}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Retry Failed ({errorCount})</span>
                  </button>
                  <button
                    onClick={handleClearFailed}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 text-xs font-bold transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Failed</span>
                  </button>
                </>
              )}

              <button
                onClick={handleSaveAllBulk}
                disabled={
                  saving ||
                  uploadedCount === 0 ||
                  !scheduleGenerated ||
                  uploadingCount > 0 ||
                  pendingCount > 0
                }
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white text-sm font-black shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{savingStatus || 'Scheduling...'}</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>
                      {uploadedCount === totalCount && totalCount > 0
                        ? `Confirm & Schedule All (${totalCount})`
                        : uploadedCount > 0
                        ? `Confirm & Schedule (${uploadedCount} of ${totalCount} Ready)`
                        : 'Confirm & Schedule (0 Ready)'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Batch Status & Progress Overview */}
          {totalCount > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-[#14141a] border border-[#22222a] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {uploadedCount} Uploaded
                  </span>
                  {uploadingCount > 0 && (
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                      {uploadingCount} Uploading
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-1.5 text-neutral-400">
                      <Clock className="w-3.5 h-3.5" />
                      {pendingCount} In Queue
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1.5 text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {errorCount} Failed
                    </span>
                  )}
                </div>
                <div className="text-neutral-400 font-mono">
                  {uploadedCount}/{totalCount} Completed ({overallProgress}%)
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-[#22222a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-emerald-500 transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 text-sm">
                No items in queue yet. Upload files or select from your Media Library to start building your batch schedule.
              </div>
            ) : (
              items.map((item, idx) => {
                const targetAccounts = accounts.filter((a) => item.selectedAccountIds.includes(a.id));
                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl bg-[#0e0e12]/60 border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-5 ${
                      item.status === 'ERROR'
                        ? 'border-red-900/40 bg-red-950/10'
                        : item.status === 'UPLOADING'
                        ? 'border-sky-900/40'
                        : 'border-[#22222a]'
                    }`}
                  >
                    <div className="flex items-center gap-4 overflow-hidden w-full md:w-auto flex-1">
                      <span className="w-7 text-center text-sm font-black text-neutral-500 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {/* Thumbnail & Upload Progress Box */}
                      <div className="w-16 h-16 rounded-xl bg-[#18181f] overflow-hidden shrink-0 border border-[#33333e] flex flex-col items-center justify-center relative">
                        {item.status === 'UPLOADED' && item.url ? (
                          item.mimeType.startsWith('video') ? (
                            <video src={item.url} className="w-full h-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                          )
                        ) : item.status === 'UPLOADING' ? (
                          <div className="flex flex-col items-center justify-center p-1 text-center">
                            <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-1" />
                            <span className="text-[10px] text-sky-400 font-bold font-mono">
                              {item.progress || 0}%
                            </span>
                          </div>
                        ) : item.status === 'ERROR' ? (
                          <div className="flex flex-col items-center justify-center text-center p-1 text-red-400">
                            <AlertCircle className="w-5 h-5 mb-0.5" />
                            <span className="text-[9px] font-bold">Failed</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-1 text-neutral-500">
                            <Clock className="w-4 h-4 mb-0.5" />
                            <span className="text-[9px] font-semibold">Queue</span>
                          </div>
                        )}
                      </div>

                      <div className="overflow-hidden flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm md:text-base font-bold text-white truncate max-w-md">
                            {item.name}
                          </p>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            ({(item.size / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                          {targetAccounts.length > 1 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/50 text-red-300 border border-red-500/30 shrink-0">
                              Shared R2 Asset → {targetAccounts.length} Platforms
                            </span>
                          )}
                          {item.isSharedReused && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 shrink-0">
                              Existing R2 Stored
                            </span>
                          )}
                        </div>

                        {/* Uploading progress bar */}
                        {item.status === 'UPLOADING' && (
                          <div className="mt-2 w-full max-w-md">
                            <div className="flex items-center justify-between text-[10px] text-sky-400 font-semibold mb-1">
                              <span>Uploading to Cloudflare R2...</span>
                              <span className="font-mono">{item.progress || 0}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-sky-500 transition-all duration-150"
                                style={{ width: `${item.progress || 0}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Error Notice & Inline Retry */}
                        {item.status === 'ERROR' && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-red-400 bg-red-950/60 px-2.5 py-1 rounded-lg border border-red-900/60 break-words">
                              {item.errorMessage || 'Upload failed.'}
                            </span>
                            <button
                              onClick={() => handleRetryItem(item.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-all shadow-sm"
                            >
                              <RotateCw className="w-3 h-3" />
                              <span>Retry Upload</span>
                            </button>
                          </div>
                        )}

                        <input
                          type="text"
                          value={item.caption}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) =>
                              prev.map((i) => (i.id === item.id ? { ...i, caption: val } : i))
                            );
                          }}
                          className="w-full text-xs md:text-sm mt-2 p-1 bg-transparent border-b border-[#33333e] text-neutral-300 focus:outline-none focus:border-red-500"
                          placeholder="Caption..."
                        />

                        <div className="flex items-center gap-1.5 mt-2">
                          {targetAccounts.map((a) => (
                            <div
                              key={a.id}
                              className="relative group"
                              title={`${a.name || a.username}${
                                a.platform === 'FACEBOOK' ? ' (Facebook Page)' : ''
                              }`}
                            >
                              <PlatformIcon platform={a.platform} size={16} className="w-4 h-4 rounded" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Schedule time controls & delete */}
                    <div className="flex flex-col items-start md:items-end justify-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#22222a]">
                      {item.status === 'ERROR' ? (
                        <div className="flex flex-col items-start md:items-end mb-1">
                          <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                            Upload Failed (Retry required)
                          </span>
                        </div>
                      ) : scheduleGenerated ? (
                        <div className="flex flex-col items-start md:items-end mb-1">
                          <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            {item.scheduledDate} at {item.scheduledTime}
                          </span>
                          <span className="text-[10px] text-neutral-500 mt-1 font-semibold uppercase">
                            {timezone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg mb-1 border border-amber-500/20">
                          Needs Schedule Matrix
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        {item.status === 'ERROR' && (
                          <button
                            onClick={() => handleRetryItem(item.id)}
                            title="Retry Upload"
                            className="p-2 rounded-xl text-red-400 hover:text-white hover:bg-red-500/20 transition-colors"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          title="Remove item"
                          className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Media Library Selector Modal */}
        {showLibraryModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0e0e12] border border-[#22222a] rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#22222a]">
                <div className="flex items-center gap-3">
                  <Film className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-bold text-white">Select from Existing Media Assets</h3>
                </div>
                <button
                  onClick={() => setShowLibraryModal(false)}
                  className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-neutral-400">
                Choose previously uploaded video assets stored in Cloudflare R2 to reuse them directly in this batch schedule without re-uploading.
              </p>

              {loadingLibrary ? (
                <div className="py-16 text-center text-neutral-400 text-sm">
                  <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading stored media...
                </div>
              ) : libraryAssets.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 text-sm">
                  No video assets found in your workspace library. Upload new videos to start building your shared library.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1">
                  {libraryAssets.map((asset) => {
                    const isSelected = selectedLibraryIds.includes(asset.id);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => {
                          setSelectedLibraryIds((prev) =>
                            prev.includes(asset.id)
                              ? prev.filter((id) => id !== asset.id)
                              : [...prev, asset.id]
                          );
                        }}
                        className={`cursor-pointer rounded-2xl border p-2.5 transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-red-950/40 border-red-500 text-white'
                            : 'bg-[#14141a] border-[#22222a] text-neutral-300 hover:border-neutral-600'
                        }`}
                      >
                        <div className="aspect-video bg-[#09090c] rounded-xl overflow-hidden mb-2 flex items-center justify-center border border-[#22222a]">
                          {asset.playbackUrl ? (
                            <video src={asset.playbackUrl} className="w-full h-full object-cover" />
                          ) : (
                            <Film className="w-6 h-6 text-neutral-600" />
                          )}
                        </div>
                        <p className="text-xs font-bold truncate">{asset.originalName || asset.filename}</p>
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1">
                          <span>{(asset.size / (1024 * 1024)).toFixed(1)} MB</span>
                          {isSelected && <span className="text-red-400 font-bold">Selected</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#22222a]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-neutral-400">
                    {selectedLibraryIds.length} asset{selectedLibraryIds.length === 1 ? '' : 's'} selected
                  </span>
                  {libraryAssets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLibraryIds.length === libraryAssets.length) {
                          setSelectedLibraryIds([]);
                        } else {
                          setSelectedLibraryIds(libraryAssets.map((a) => a.id));
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
                    >
                      {selectedLibraryIds.length === libraryAssets.length
                        ? 'Deselect All'
                        : `Select All (${libraryAssets.length})`}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowLibraryModal(false)}
                    className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddFromLibrary}
                    disabled={selectedLibraryIds.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30"
                  >
                    Add to Batch Queue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
