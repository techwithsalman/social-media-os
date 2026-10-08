'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import { MediaThumbnail } from '@/components/ui/MediaThumbnail';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Play,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
  XCircle,
  MoreVertical,
  Search,
  Filter
} from 'lucide-react';
import {
  TIMEZONE_OPTIONS,
  WORKSPACE_TIMEZONE,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  formatTimeInputInTimeZone,
  getDateKeyInTimeZone,
  getTimezoneLabel,
  getTodayDateKey,
  zonedDateTimeToUtcIso,
} from '@/lib/timezone';

interface ScheduledPostItem {
  id: string;
  masterCaption: string;
  scheduledFor: string | null;
  timezone: string | null;
  status: string;
  mediaAssetId?: string | null;
  mediaAsset?: {
    id: string;
    url: string;
    thumbnailUrl?: string;
    mimeType?: string;
    filename?: string;
  } | null;
  platformPosts: Array<{
    id: string;
    socialAccountId: string;
    platform: string;
    status: string;
    customCaption?: string | null;
    socialAccount?: {
      id: string;
      platform: string;
      name: string;
      username: string;
      profileImageUrl: string | null;
      isMock: boolean;
    };
  }>;
}

export default function ScheduledPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<ScheduledPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Actions
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  // Reschedule Modal
  const [reschedulePostId, setReschedulePostId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newTimezone, setNewTimezone] = useState(WORKSPACE_TIMEZONE);
  const [rescheduleError, setRescheduleError] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      // Fetch up to 200 posts to allow rich frontend filtering
      const res = await fetch('/api/posts?status=SCHEDULED&limit=200');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      } else {
        throw new Error('Failed to fetch posts');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPostTimezone = (post: ScheduledPostItem) => {
    return post.timezone || WORKSPACE_TIMEZONE;
  };

  const getPostCalendarDate = (post: ScheduledPostItem) => {
    if (!post.scheduledFor) return getTodayDateKey(getPostTimezone(post));
    return getDateKeyInTimeZone(post.scheduledFor, getPostTimezone(post));
  };

  // Filtered and Sorted Posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const hasMatchingStatus = post.status.toUpperCase() === statusFilter || 
                                  post.platformPosts.some(p => p.status.toUpperCase() === statusFilter);
        if (!hasMatchingStatus) return false;
      }
      
      // 2. Platform Filter
      if (platformFilter !== 'ALL') {
        const hasPlatform = post.platformPosts.some(p => p.platform.toUpperCase() === platformFilter);
        if (!hasPlatform) return false;
      }

      // 3. Account Filter
      if (accountFilter !== 'ALL') {
        const hasAccount = post.platformPosts.some(p => p.socialAccountId === accountFilter);
        if (!hasAccount) return false;
      }

      // 4. Date Filter
      if (dateFilter) {
        if (getPostCalendarDate(post) !== dateFilter) return false;
      }

      // 5. Search Query (Caption or filename)
      if (searchQuery) {
        const sq = searchQuery.toLowerCase();
        const matchCaption = post.masterCaption?.toLowerCase().includes(sq);
        const matchFile = post.mediaAsset?.filename?.toLowerCase().includes(sq);
        if (!matchCaption && !matchFile) return false;
      }

      return true;
    }).sort((a, b) => {
      // Ascending by date
      if (!a.scheduledFor) return 1;
      if (!b.scheduledFor) return -1;
      return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
    });
  }, [posts, statusFilter, platformFilter, accountFilter, dateFilter, searchQuery]);

  const paginatedPosts = filteredPosts.slice(0, currentPage * itemsPerPage);

  const uniqueAccounts = useMemo(() => {
    const accs = new Map();
    posts.forEach(post => {
      post.platformPosts.forEach(pp => {
        if (pp.socialAccount) accs.set(pp.socialAccount.id, pp.socialAccount);
      });
    });
    return Array.from(accs.values());
  }, [posts]);

  // Actions
  const handlePublishNow = async (id: string) => {
    if (!confirm('Are you sure you want to publish this post immediately?')) return;
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/posts/${id}/publish`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish');
      }
      await fetchPosts();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled post?')) return;
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!res.ok) throw new Error('Failed to cancel');
      await fetchPosts();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this scheduled post?')) return;
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchPosts();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicate = async (post: ScheduledPostItem) => {
    try {
      setActionLoadingId(post.id);
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCaption: post.masterCaption,
          mediaAssetId: post.mediaAsset?.id || post.mediaAssetId || null,
          publishNow: false,
          status: 'DRAFT',
          timezone: getPostTimezone(post),
          platformSettings: post.platformPosts.map((platformPost) => ({
            socialAccountId: platformPost.socialAccountId,
            platform: platformPost.platform,
            customCaption: platformPost.customCaption || post.masterCaption,
            status: 'DRAFT'
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to duplicate post');
      const data = await res.json();
      router.push(`/create-post?id=${data.post.id}`);
    } catch (e: any) {
      alert(e.message);
      setActionLoadingId(null);
    }
  };

  const openRescheduleModal = (post: ScheduledPostItem) => {
    setReschedulePostId(post.id);
    const tz = getPostTimezone(post);
    setNewTimezone(tz);
    if (post.scheduledFor) {
      setNewDate(getDateKeyInTimeZone(post.scheduledFor, tz));
      setNewTime(formatTimeInputInTimeZone(post.scheduledFor, tz));
    } else {
      setNewDate(getTodayDateKey(tz));
      setNewTime('12:00');
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!newDate || !newTime || !newTimezone) {
      setRescheduleError('Please select date, time, and timezone');
      return;
    }

    try {
      setActionLoadingId(reschedulePostId);
      const utcIso = zonedDateTimeToUtcIso(newDate, newTime, newTimezone);
      
      const res = await fetch(`/api/posts/${reschedulePostId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledFor: utcIso,
          timezone: newTimezone,
        }),
      });

      if (!res.ok) throw new Error('Failed to reschedule');
      
      setReschedulePostId(null);
      await fetchPosts();
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'SCHEDULED') return <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">Scheduled</span>;
    if (s === 'PUBLISHED') return <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Published</span>;
    if (s === 'FAILED') return <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">Failed</span>;
    if (s === 'PROCESSING' || s === 'QUEUED') return <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">Processing</span>;
    return <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">{s}</span>;
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Clock className="w-8 h-8 text-red-500" />
            Scheduled Posts ({filteredPosts.length})
          </h1>
          <p className="text-neutral-400 mt-2 text-sm md:text-base">
            Manage your upcoming scheduled content across all platforms.
          </p>
        </div>
        <Link
          href="/create-post"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-600/20"
        >
          <Plus className="w-5 h-5" />
          <span>Create Post</span>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {/* FILTERS */}
      <div className="bg-[#0e0e12] border border-[#22222a] rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-1">
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Caption or filename" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#18181f] border border-[#33333e] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Status</label>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-[#18181f] border border-[#33333e] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Platform</label>
          <select 
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-[#18181f] border border-[#33333e] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="ALL">All Platforms</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="X">X (Twitter)</option>
            <option value="LINKEDIN">LinkedIn</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Account</label>
          <select 
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-[#18181f] border border-[#33333e] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="ALL">All Accounts</option>
            {uniqueAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.username || acc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Date</label>
          <input 
            type="date" 
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-[#18181f] border border-[#33333e] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center bg-[#0e0e12] border border-[#22222a] rounded-3xl">
          <Clock className="w-12 h-12 text-neutral-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No scheduled posts found</h3>
          <p className="text-neutral-400 max-w-sm">
            Adjust your filters or schedule a new post.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {paginatedPosts.map((post) => {
            const tz = getPostTimezone(post);
            const isVideo = post.mediaAsset?.mimeType?.startsWith('video/');
            const hasRealThumbnail = !!post.mediaAsset?.thumbnailUrl;
            const hasImageUrl = !!post.mediaAsset?.url && !isVideo;
            
            const displayImageUrl = hasRealThumbnail ? post.mediaAsset!.thumbnailUrl : (hasImageUrl ? post.mediaAsset!.url : null);
            
            const disabled = actionLoadingId === post.id;

            return (
              <div
                key={post.id}
                className="group flex flex-col lg:flex-row bg-[#0e0e12] border border-[#22222a] hover:border-[#33333e] rounded-2xl p-4 gap-4 transition-all"
              >
                {/* LEFT: THUMBNAIL & ACCOUNTS */}
                <div className="flex flex-row lg:flex-col items-center lg:items-start gap-4 shrink-0 lg:w-48">
                  <MediaThumbnail 
                    mediaAsset={post.mediaAsset || null} 
                    className="relative w-20 h-20 lg:w-full lg:h-32 rounded-xl shrink-0 border border-[#33333e]" 
                    iconClassName="w-8 h-8 opacity-50 text-neutral-600"
                  />
                  
                  <div className="flex flex-wrap gap-1.5 w-full">
                    {post.platformPosts.map((pp) => (
                      <div key={pp.id} className="flex items-center gap-1.5 bg-[#18181f] border border-[#33333e] px-2 py-1 rounded-lg" title={pp.socialAccount?.name}>
                        <PlatformIcon platform={pp.platform} size={14} className="rounded-sm" />
                        <span className="text-[10px] text-neutral-300 font-bold truncate max-w-[80px]">
                          {pp.socialAccount?.username || pp.socialAccount?.name || pp.platform}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CENTER: DETAILS */}
                <div className="flex-1 min-w-0 flex flex-col py-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <p className="text-sm font-semibold text-neutral-200 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {post.masterCaption || <span className="text-neutral-500 italic">No caption</span>}
                    </p>
                  </div>
                  
                  {post.mediaAsset?.filename && (
                    <div className="text-xs text-neutral-500 font-medium mb-3 truncate">
                      File: {post.mediaAsset.filename}
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-neutral-500" />
                      <span className="text-sm font-bold text-white">
                        {post.scheduledFor ? formatDateInTimeZone(post.scheduledFor, tz) : 'Unscheduled'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-neutral-500" />
                      <span className="text-sm font-bold text-white">
                        {post.scheduledFor ? formatTimeInTimeZone(post.scheduledFor, tz) : '--:--'}
                      </span>
                      <span className="text-xs font-bold text-neutral-500 bg-[#18181f] px-2 py-0.5 rounded-md">
                        {getTimezoneLabel(tz)}
                      </span>
                    </div>

                    <div className="ml-auto">
                      {renderStatusBadge(post.status)}
                    </div>
                  </div>
                </div>

                {/* RIGHT: ACTIONS */}
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-end gap-2 lg:w-32 shrink-0 border-t lg:border-t-0 border-[#22222a] pt-4 lg:pt-0">
                  <Link
                    href={`/create-post?id=${post.id}`}
                    className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-[#18181f] text-neutral-300 border border-transparent text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Link>

                  <button
                    onClick={() => openRescheduleModal(post)}
                    disabled={disabled}
                    className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/70 text-red-400 border border-red-500/30 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Reschedule</span>
                  </button>

                  <div className="relative group/menu flex-1 lg:flex-none w-full flex justify-center">
                    <button className="w-full lg:w-auto inline-flex justify-center items-center px-3 py-2 rounded-xl hover:bg-[#18181f] text-neutral-400 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    <div className="absolute right-0 lg:right-0 bottom-full lg:bottom-auto lg:top-full mt-2 w-48 bg-[#18181f] border border-[#33333e] rounded-xl shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 py-1">
                      <button
                        onClick={() => router.push(`/calendar?date=${getPostCalendarDate(post)}`)}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-[#22222a]"
                      >
                        View in Calendar
                      </button>
                      <button
                        onClick={() => handleDuplicate(post)}
                        disabled={disabled}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-[#22222a]"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handlePublishNow(post.id)}
                        disabled={disabled}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10"
                      >
                        Publish Now
                      </button>
                      <hr className="border-[#33333e] my-1" />
                      <button
                        onClick={() => handleCancel(post.id)}
                        disabled={disabled}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/10"
                      >
                        Cancel Post
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={disabled}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredPosts.length > paginatedPosts.length && (
            <button 
              onClick={() => setCurrentPage(p => p + 1)}
              className="mt-4 w-full py-3 rounded-xl border border-[#33333e] hover:bg-[#18181f] text-sm font-bold text-neutral-300 transition-colors"
            >
              Load More
            </button>
          )}
        </div>
      )}

      {reschedulePostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0e0e12] border border-[#22222a] rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#22222a] mb-6">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-red-500" />
                <h4 className="text-base md:text-lg font-bold text-white">Reschedule Content</h4>
              </div>
              <button
                onClick={() => {
                  setReschedulePostId(null);
                  setRescheduleError('');
                }}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rescheduleError && (
              <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rescheduleError}</span>
              </div>
            )}

            <div className="space-y-5 mb-8">
              <div>
                <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-2">
                  Publish Date
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-2">
                  Publish Time
                </label>
                <input
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-neutral-300 mb-2">
                  Timezone
                </label>
                <select
                  value={newTimezone}
                  onChange={(e) => setNewTimezone(e.target.value)}
                  className="w-full p-3 text-sm bg-[#0e0e12] border border-[#22222a] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3.5">
              <button
                onClick={() => {
                  setReschedulePostId(null);
                  setRescheduleError('');
                }}
                className="px-5 py-2.5 text-sm font-semibold text-neutral-400 hover:bg-[#18181f] rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={actionLoadingId === reschedulePostId}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md disabled:opacity-50"
              >
                Save New Time
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
