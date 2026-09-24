'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import {
  Upload,
  Layers,
  Sparkles,
  Calendar,
  Clock,
  Trash2,
  CheckCircle2,
  ArrowRight,
  FileText,
  Sliders,
} from 'lucide-react';

interface BulkItem {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  caption: string;
  scheduledDate: string;
  scheduledTime: string;
  platforms: string[];
}

export default function BulkUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BulkItem[]>([
    {
      id: 'bulk_1',
      name: 'Product-Teaser-Reel-01.mp4',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
      size: 14200000,
      mimeType: 'video/mp4',
      caption: 'Transform your social media workflow with Social Media OS! 🚀 #productivity #creator',
      scheduledDate: '2026-09-01',
      scheduledTime: '09:00',
      platforms: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK'],
    },
    {
      id: 'bulk_2',
      name: 'Behind-The-Scenes-Studio-02.mp4',
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80',
      size: 19800000,
      mimeType: 'video/mp4',
      caption: 'A day in the life building next-gen web products. 💻✨ #buildinpublic #tech',
      scheduledDate: '2026-09-01',
      scheduledTime: '12:00',
      platforms: ['INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'X'],
    },
    {
      id: 'bulk_3',
      name: 'Feature-Breakdown-Clip-03.mp4',
      url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&auto=format&fit=crop&q=80',
      size: 16500000,
      mimeType: 'video/mp4',
      caption: 'Top 3 tips for scaling multi-platform distribution simultaneously. 📈 #marketing',
      scheduledDate: '2026-09-01',
      scheduledTime: '15:00',
      platforms: ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'LINKEDIN'],
    },
  ]);

  const [bulkMasterCaption, setBulkMasterCaption] = useState('');
  const [applyToAllVideos, setApplyToAllVideos] = useState(true);

  const [postsPerDay, setPostsPerDay] = useState(3);
  const [startDate, setStartDate] = useState('2026-09-01');
  const [timeSlots, setTimeSlots] = useState(['09:00', '12:00', '15:00', '18:00', '21:00']);
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'INSTAGRAM',
    'FACEBOOK',
    'TIKTOK',
    'YOUTUBE',
    'LINKEDIN',
    'X',
  ]);

  const [saving, setSaving] = useState(false);
  const [successBanner, setSuccessBanner] = useState(false);

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
    const slotsToUse = timeSlots.slice(0, postsPerDay);
    const start = new Date(startDate);

    setItems((prev) =>
      prev.map((item, idx) => {
        const dayOffset = Math.floor(idx / postsPerDay);
        const slotIdx = idx % postsPerDay;
        const targetDate = new Date(start);
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');

        return {
          ...item,
          scheduledDate: `${yyyy}-${mm}-${dd}`,
          scheduledTime: slotsToUse[slotIdx] || '12:00',
          platforms: [...selectedPlatforms],
        };
      })
    );
  };

  const handleBatchUpload = (files: FileList | null) => {
    if (!files) return;
    const newItems: BulkItem[] = [];

    Array.from(files).forEach((file, idx) => {
      newItems.push({
        id: `bulk_new_${Date.now()}_${idx}`,
        name: file.name,
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
        size: file.size,
        mimeType: file.type || 'video/mp4',
        caption: bulkMasterCaption || `Video content item #${items.length + idx + 1}`,
        scheduledDate: startDate,
        scheduledTime: '12:00',
        platforms: [...selectedPlatforms],
      });
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleSaveAllBulk = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setSuccessBanner(true);
      setTimeout(() => {
        router.push('/calendar');
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Bulk Upload & Automatic Schedule Generator">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
          Batch Media Uploader & Schedule Matrix
        </h1>
        <p className="text-sm md:text-base text-slate-400 mt-1.5">
          Upload up to 50 videos simultaneously and generate multi-day posting schedules automatically.
        </p>
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
        <div className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Automatic Matrix Config
            </h3>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
              Posts Per Day
            </label>
            <select
              value={postsPerDay}
              onChange={(e) => setPostsPerDay(parseInt(e.target.value, 10))}
              className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white"
            >
              <option value="1">1 Post / Day</option>
              <option value="2">2 Posts / Day</option>
              <option value="3">3 Posts / Day</option>
              <option value="5">5 Posts / Day</option>
            </select>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
              Starting Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white"
            >
              <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2.5">
              Target Networks
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'X'].map((plat) => {
                const isChecked = selectedPlatforms.includes(plat);
                return (
                  <label
                    key={plat}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs md:text-sm font-semibold cursor-pointer ${
                      isChecked
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-white'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedPlatforms((prev) =>
                          prev.includes(plat) ? prev.filter((p) => p !== plat) : [...prev, plat]
                        );
                      }}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 w-4 h-4"
                    />
                    <PlatformIcon platform={plat} size={16} className="w-4 h-4 rounded" />
                    <span>{plat}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleGenerateSchedule}
            className="w-full mt-3 py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Schedule Matrix</span>
          </button>
        </div>

        {/* Right: Master Caption & Multi-Dropzone (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md">
            <h3 className="text-sm md:text-base font-bold text-white uppercase tracking-wider mb-3">
              Bulk Master Caption
            </h3>
            <textarea
              rows={4}
              value={bulkMasterCaption}
              onChange={(e) => setBulkMasterCaption(e.target.value)}
              placeholder="Enter master caption to apply across all uploaded items in this batch..."
              className="w-full p-4 text-sm md:text-base bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-800">
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAllVideos}
                  onChange={(e) => setApplyToAllVideos(e.target.checked)}
                  className="rounded-md border-slate-700 bg-slate-900 text-indigo-600 w-4 h-4"
                />
                <span>Apply caption to all batch videos & platforms</span>
              </label>

              <button
                onClick={handleApplyBulkCaption}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-indigo-300 border border-slate-700 transition-colors"
              >
                Apply to List
              </button>
            </div>
          </div>

          {/* Multi-Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-3xl p-8 text-center bg-[#0d1322]/80 hover:bg-[#0d1322] transition-all group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => handleBatchUpload(e.target.files)}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-white">
              Drop batch video & image files here to add to queue
            </p>
            <p className="text-xs md:text-sm text-slate-400 mt-1.5">
              Supports 20+ videos at once (MP4, MOV, JPG, PNG)
            </p>
          </div>
        </div>
      </div>

      {/* Generated Content Batch List */}
      <div className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg md:text-xl font-bold text-white">
              Queued Content Items ({items.length})
            </h3>
          </div>

          <button
            onClick={handleSaveAllBulk}
            disabled={saving || items.length === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-black shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
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
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <span className="w-7 text-center text-sm font-black text-slate-500 shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm md:text-base font-bold text-white truncate">{item.name}</p>
                  <p className="text-xs md:text-sm text-slate-300 mt-1 line-clamp-1">
                    {item.caption}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {item.platforms.map((p) => (
                      <PlatformIcon key={p} platform={p} size={16} className="w-4 h-4 rounded" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Schedule time controls & delete */}
              <div className="flex items-center gap-3.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                <div className="flex items-center gap-2.5">
                  <input
                    type="date"
                    value={item.scheduledDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, scheduledDate: val } : i))
                      );
                    }}
                    className="p-2 text-xs md:text-sm bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                  <input
                    type="time"
                    value={item.scheduledTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, scheduledTime: val } : i))
                      );
                    }}
                    className="p-2 text-xs md:text-sm bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>

                <button
                  onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
