'use client';

import React, { useState, useRef, useEffect } from 'react';
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

export default function BulkUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [items, setItems] = useState<BulkItem[]>([]);
  const [bulkMasterCaption, setBulkMasterCaption] = useState('');
  const [applyToAllVideos, setApplyToAllVideos] = useState(true);

  const [postsPerDay, setPostsPerDay] = useState(3);
  const defaultTimeSlotsForCount = (count: number) => {
    switch (count) {
      case 1: return ['09:00'];
      case 2: return ['09:00', '15:00'];
      case 3: return ['09:00', '12:00', '15:00'];
      case 4: return ['09:00', '12:00', '15:00', '18:00'];
      case 5: return ['09:00', '11:00', '13:00', '15:00', '18:00'];
      case 6: return ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
      default: return Array.from({ length: count }, (_, i) => `${String(9 + i).padStart(2, '0')}:00`);
    }
  };
  
  const handlePostsPerDayChange = (newCount: number) => {
    setPostsPerDay(newCount);
    setTimeSlots(prev => {
      const defaults = defaultTimeSlotsForCount(newCount);
      const newSlots = [];
      for (let i = 0; i < newCount; i++) {
        newSlots.push(prev[i] || defaults[i] || '12:00');
      }
      return newSlots;
    });
    setScheduleGenerated(false);
  };
  
  const [startDate, setStartDate] = useState('2026-09-01');
  const [timeSlots, setTimeSlots] = useState(['09:00', '12:00', '15:00', '18:00', '21:00']);
  const [timezone, setTimezone] = useState(WORKSPACE_TIMEZONE);

  const [saving, setSaving] = useState(false);
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

  const openLibraryModal = async () => {
    setShowLibraryModal(true);
    setSelectedLibraryIds([]);
    try {
      setLoadingLibrary(true);
      const res = await fetch('/api/upload?type=video&limit=40');
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
    const selectedAssets = libraryAssets.filter(a => selectedLibraryIds.includes(a.id));
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
      isSharedReused: true,
    }));

    setItems(prev => [...prev, ...newItems]);
    setShowLibraryModal(false);
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
      setGenerateError('Select at least one social account.');
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

    const slotsToUse = timeSlots.slice(0, postsPerDay);
    const parts = startDate.split('-');
    const yyyyStart = parseInt(parts[0], 10);
    const mmStart = parseInt(parts[1], 10) - 1;
    const ddStart = parseInt(parts[2], 10);

    setItems((prev) =>
      prev.map((item, idx) => {
        const dayOffset = Math.floor(idx / postsPerDay);
        const slotIdx = idx % postsPerDay;
        const targetDate = new Date(yyyyStart, mmStart, ddStart);
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');

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

  const uploadFile = async (file: File, itemId: string) => {
    try {
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: 'UPLOADING' } : i));

      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size })
      });
      const presignedData = await presignedRes.json();
      if (!presignedRes.ok) throw new Error(presignedData.error);

      // Single-Object Storage Deduplication:
      // If asset already exists in Cloudflare R2, reuse it immediately without uploading again!
      if (presignedData.alreadyExists && presignedData.media) {
        setItems((prev) => prev.map((i) => i.id === itemId ? {
          ...i,
          status: 'UPLOADED',
          mediaAssetId: presignedData.media.id,
          url: presignedData.media.url,
          isSharedReused: true,
        } : i));
        return;
      }

      const r2Res = await fetch(presignedData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!r2Res.ok) throw new Error('Failed to upload to R2');

      const finalizeRes = await fetch('/api/upload/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectKey: presignedData.objectKey,
          filename: file.name,
          mimeType: file.type,
          size: file.size
        })
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeData.error);

      setItems((prev) => prev.map((i) => i.id === itemId ? {
        ...i,
        status: 'UPLOADED',
        mediaAssetId: finalizeData.media.id,
        url: finalizeData.media.url,
        isSharedReused: false,
      } : i));

    } catch (err: any) {
      console.error(err);
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: 'ERROR' } : i));
    }
  };

  const handleBatchUpload = (files: FileList | null) => {
    if (!files) return;
    const newItems: BulkItem[] = [];

    Array.from(files).forEach((file, idx) => {
      const id = `bulk_${Date.now()}_${idx}`;
      newItems.push({
        id,
        name: file.name,
        url: '', // will be set after upload
        size: file.size,
        mimeType: file.type || 'video/mp4',
        caption: bulkMasterCaption || `Video content item #${items.length + idx + 1}`,
        scheduledDate: startDate,
        scheduledTime: '12:00',
        selectedAccountIds: [...selectedAccountIds],
        status: 'PENDING',
      });
    });

    setItems((prev) => [...prev, ...newItems]);

    // Start uploads
    const filesArray = Array.from(files);
    newItems.forEach((item, idx) => {
      uploadFile(filesArray[idx], item.id);
    });
  };

  const handleSaveAllBulk = async () => {
    if (items.some(i => i.status === 'UPLOADING' || i.status === 'PENDING')) {
      alert("Please wait for all uploads to complete.");
      return;
    }

    setSaving(true);
    try {
      const payloadItems = items.filter(i => i.status === 'UPLOADED').map(item => {
        const utcIso = zonedDateTimeToUtcIso(item.scheduledDate, item.scheduledTime, timezone);
        
        const platformSettings = accounts
          .filter(a => item.selectedAccountIds.includes(a.id))
          .map(a => ({
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
          platformSettings
        };
      });

      const res = await fetch('/api/posts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessBanner(true);
      setTimeout(() => {
        router.push('/calendar');
      }, 1500);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save bulk posts');
    } finally {
      setSaving(false);
    }
  };

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
                Upload up to 50 videos simultaneously with shared single-object R2 storage and generate multi-day posting schedules automatically.
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
                onChange={(e) => { setStartDate(e.target.value); setScheduleGenerated(false); }}
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
                onChange={(e) => { setTimezone(e.target.value); setScheduleGenerated(false); }}
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
                ) : accounts.map((acc) => {
                  const isChecked = selectedAccountIds.includes(acc.id);
                  return (
                    <label
                      key={acc.id}
                      title={`${acc.name || acc.username}${acc.username && acc.username !== acc.name ? ` (${acc.username})` : ''}`}
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
                            prev.includes(acc.id) ? prev.filter((p) => p !== acc.id) : [...prev, acc.id]
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
                })}
              </div>
            </div>
            
            {generateError && (
              <div className="text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                {generateError}
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
                  onChange={(e) => handleBatchUpload(e.target.files)}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm md:text-base font-bold text-white">
                  Upload New Files
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Upload MP4/MOV videos to R2 once
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
              {scheduleGenerated && items.length > 0 && (
                <div className="text-sm font-semibold text-neutral-400">
                  {items.length} videos • {postsPerDay} posts/day • {Math.ceil(items.length / postsPerDay)} publishing days<br/>
                  Starts {items[0]?.scheduledDate} • Timezone: {timezone}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveAllBulk}
              disabled={saving || items.length === 0 || !scheduleGenerated || items.some(i => i.status !== 'UPLOADED' && i.status !== 'ERROR')}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white text-sm font-black shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>Confirm & Schedule All ({items.length})</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 text-sm">
                No items in queue yet. Upload files or select from your Media Library to start building your batch schedule.
              </div>
            ) : (
              items.map((item, idx) => {
                const targetAccounts = accounts.filter(a => item.selectedAccountIds.includes(a.id));
                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-[#0e0e12]/60 border border-[#22222a] flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="flex items-center gap-4 overflow-hidden w-full md:w-auto flex-1">
                      <span className="w-7 text-center text-sm font-black text-neutral-500 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="w-16 h-16 rounded-xl bg-[#18181f] overflow-hidden shrink-0 border border-[#33333e] flex items-center justify-center">
                        {item.status === 'UPLOADED' && item.url ? (
                          item.mimeType.startsWith('video') ? (
                            <video src={item.url} className="w-full h-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                          )
                        ) : item.status === 'UPLOADING' ? (
                          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : item.status === 'ERROR' ? (
                          <span className="text-xs text-red-400 font-bold">Error</span>
                        ) : (
                          <span className="text-xs text-neutral-500">Wait</span>
                        )}
                      </div>
                      <div className="overflow-hidden flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm md:text-base font-bold text-white truncate">{item.name}</p>
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
                        
                        <input 
                          type="text" 
                          value={item.caption}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, caption: val } : i));
                          }}
                          className="w-full text-xs md:text-sm mt-1 p-1 bg-transparent border-b border-[#33333e] text-neutral-300 focus:outline-none focus:border-red-500"
                          placeholder="Caption..."
                        />

                        <div className="flex items-center gap-1.5 mt-2">
                          {targetAccounts.map(a => (
                            <div key={a.id} className="relative group" title={`${a.name || a.username}${a.platform === 'FACEBOOK' ? ' (Facebook Page)' : ''}`}>
                              <PlatformIcon platform={a.platform} size={16} className="w-4 h-4 rounded" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Schedule time controls & delete */}
                    <div className="flex flex-col items-start md:items-end justify-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#22222a]">
                      {scheduleGenerated ? (
                        <div className="flex flex-col items-start md:items-end mb-1">
                          <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            {item.scheduledDate} at {item.scheduledTime}
                          </span>
                          <span className="text-[10px] text-neutral-500 mt-1 font-semibold uppercase">{timezone}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg mb-1 border border-red-500/20">
                          Needs Schedule Matrix
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
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
                          setSelectedLibraryIds(prev =>
                            prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id]
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

              <div className="flex items-center justify-between pt-4 border-t border-[#22222a]">
                <span className="text-xs font-semibold text-neutral-400">
                  {selectedLibraryIds.length} asset{selectedLibraryIds.length === 1 ? '' : 's'} selected
                </span>
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
