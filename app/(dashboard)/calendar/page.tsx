'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  X,
  Play,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  WORKSPACE_TIMEZONE,
  createDateFromDateKey,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getDateKeyInTimeZone,
  getTimezoneLabel,
  getTodayDateKey,
  isValidDateKey,
} from '@/lib/timezone';

interface PostItem {
  id: string;
  masterCaption: string;
  status: string;
  scheduledFor: string | null;
  timezone: string | null;
  mediaAsset?: {
    id: string;
    url: string;
    thumbnailUrl?: string;
    mimeType?: string;
    filename?: string;
  } | null;
  platformPosts: Array<{
    id: string;
    platform: string;
    status: string;
    errorMessage?: string | null;
    socialAccountId?: string;
    socialAccount?: {
      id: string;
      platform: string;
      name: string;
      username: string;
      profileImageUrl: string | null;
    };
  }>;
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function CalendarPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Month navigation
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    return createDateFromDateKey(getTodayDateKey(WORKSPACE_TIMEZONE));
  });

  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK' | 'DAY'>('MONTH');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(getTodayDateKey(WORKSPACE_TIMEZONE));

  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  useEffect(() => {
    async function loadPosts() {
      try {
        setLoading(true);
        // Fetch up to 300 to populate the calendar
        const res = await fetch('/api/posts?limit=300');
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
        }
      } catch (error) {
        console.error('Failed to load posts', error);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  const getPostTimezone = (post: PostItem) => post.timezone || WORKSPACE_TIMEZONE;

  const getPostCalendarDate = (post: PostItem) => {
    if (!post.scheduledFor) return getTodayDateKey(getPostTimezone(post));
    return getDateKeyInTimeZone(post.scheduledFor, getPostTimezone(post));
  };
  
  // Unique Accounts for filter
  const uniqueAccounts = useMemo(() => {
    const accs = new Map();
    posts.forEach(post => {
      post.platformPosts.forEach(pp => {
        if (pp.socialAccount) accs.set(pp.socialAccount.id, pp.socialAccount);
      });
    });
    return Array.from(accs.values());
  }, [posts]);

  // Filter posts
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

      return true;
    });
  }, [posts, statusFilter, platformFilter, accountFilter]);

  // Group by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, PostItem[]> = {};
    filteredPosts.forEach((post) => {
      const d = getPostCalendarDate(post);
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(post);
    });
    
    // Sort posts within each date
    Object.keys(grouped).forEach(k => {
      grouped[k].sort((a, b) => {
        if (!a.scheduledFor) return 1;
        if (!b.scheduledFor) return -1;
        return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
      });
    });
    return grouped;
  }, [filteredPosts]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const handleToday = () => {
    setCurrentDate(createDateFromDateKey(getTodayDateKey(WORKSPACE_TIMEZONE)));
    setSelectedDateKey(getTodayDateKey(WORKSPACE_TIMEZONE));
  };

  const handleDayClick = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setViewMode('DAY');
  };

  const selectedDatePosts = postsByDate[selectedDateKey] || [];

  const renderStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'SCHEDULED') return <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Scheduled</span>;
    if (s === 'PUBLISHED') return <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Published</span>;
    if (s === 'FAILED') return <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded bg-red-500/10 text-red-400 border border-red-500/20">Failed</span>;
    if (s === 'PROCESSING' || s === 'QUEUED') return <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Processing</span>;
    if (s === 'CANCELLED') return <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">Cancelled</span>;
    return <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">{s}</span>;
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-red-500" />
            Content Calendar
          </h1>
          <p className="text-neutral-400 mt-2 text-sm md:text-base">
            Plan, organize, and track your content pipeline globally.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('MONTH')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              viewMode === 'MONTH'
                ? 'bg-[#18181f] text-white border border-[#33333e]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('WEEK')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              viewMode === 'WEEK'
                ? 'bg-[#18181f] text-white border border-[#33333e]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('DAY')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              viewMode === 'DAY'
                ? 'bg-[#18181f] text-white border border-[#33333e]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Day
          </button>
          <Link
            href="/create-post"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-600/20 ml-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Post</span>
          </Link>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-[#0e0e12] border border-[#22222a] rounded-2xl p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Status</label>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#18181f] border border-[#33333e] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PUBLISHED">Published</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Platform</label>
          <select 
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#18181f] border border-[#33333e] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
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

        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Account</label>
          <select 
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#18181f] border border-[#33333e] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="ALL">All Accounts</option>
            {uniqueAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.username || acc.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between bg-[#0e0e12] border border-[#22222a] rounded-2xl p-4 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-white">
          {monthNames[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-4 py-2 rounded-xl text-sm font-bold text-neutral-300 hover:text-white bg-[#18181f] border border-[#33333e] hover:border-red-500/50 transition-colors mr-2"
          >
            Today
          </button>
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-[#18181f] border border-[#33333e] hover:border-red-500/50 text-neutral-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-[#18181f] border border-[#33333e] hover:border-red-500/50 text-neutral-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'MONTH' && (
        <div className="bg-[#0e0e12] border border-[#22222a] rounded-3xl overflow-hidden shadow-lg">
          <div className="grid grid-cols-7 border-b border-[#22222a]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-4 text-center text-xs md:text-sm font-bold text-neutral-500 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div
                key={`empty-start-${i}`}
                className="min-h-[120px] md:min-h-[160px] p-2 border-r border-b border-[#22222a] bg-[#18181f]/30"
              />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(
                day
              ).padStart(2, '0')}`;
              const dayPosts = postsByDate[dateKey] || [];
              const isToday = dateKey === getTodayDateKey(WORKSPACE_TIMEZONE);
              const isSelected = dateKey === selectedDateKey;

              return (
                <div
                  key={dateKey}
                  onClick={() => handleDayClick(dateKey)}
                  className={`min-h-[120px] md:min-h-[160px] p-2 border-r border-b border-[#22222a] cursor-pointer transition-colors relative ${
                    isSelected
                      ? 'bg-red-950/20 ring-1 ring-inset ring-red-500'
                      : 'hover:bg-[#18181f] bg-[#0e0e12]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-red-600 text-white shadow-md'
                          : 'text-neutral-300'
                      }`}
                    >
                      {day}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#18181f] text-neutral-400 border border-[#33333e]">
                        {dayPosts.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto no-scrollbar">
                    {dayPosts.map((post) => {
                      const isVideo = post.mediaAsset?.mimeType?.startsWith('video/');
                      const hasRealThumbnail = !!post.mediaAsset?.thumbnailUrl;
                      const hasImageUrl = !!post.mediaAsset?.url && !isVideo;
                      const displayImageUrl = hasRealThumbnail ? post.mediaAsset!.thumbnailUrl : (hasImageUrl ? post.mediaAsset!.url : null);

                      return (
                        <div
                          key={post.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPost(post);
                          }}
                          className="cursor-pointer p-1.5 rounded-lg bg-[#100606]/90 border border-[#22222a] hover:border-red-500/60 text-xs flex items-center gap-1.5 transition-all shadow-sm group"
                        >
                          <div className="w-5 h-5 rounded overflow-hidden shrink-0 bg-[#18181f] flex flex-col items-center justify-center">
                            {displayImageUrl ? (
                              <img src={displayImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : isVideo ? (
                                <Play className="w-2.5 h-2.5 text-neutral-500" />
                            ) : (
                                <FileText className="w-2.5 h-2.5 text-neutral-500" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0 flex flex-col">
                            <span className="text-neutral-100 truncate font-semibold text-[10px]">
                              {post.masterCaption || 'No caption'}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {renderStatusBadge(post.status)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode !== 'MONTH' && (
        <div className="bg-[#0e0e12] border border-[#22222a] rounded-3xl p-8 shadow-md">
          <div className="text-center py-10">
            <CalendarIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">
              {viewMode === 'WEEK' ? 'Week' : 'Day'} View
            </h3>
            <p className="text-sm text-neutral-400 mt-1">
              {formatDateInTimeZone(`${selectedDateKey}T00:00:00Z`, 'UTC')}
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            {selectedDatePosts.length === 0 && !loading ? (
              <div className="p-6 rounded-2xl bg-[#0e0e12]/70 border border-dashed border-[#22222a] text-center text-sm text-neutral-400">
                No scheduled posts on this date.
              </div>
            ) : (
              selectedDatePosts.map((post) => {
                const isVideo = post.mediaAsset?.mimeType?.startsWith('video/');
                const hasRealThumbnail = !!post.mediaAsset?.thumbnailUrl;
                const hasImageUrl = !!post.mediaAsset?.url && !isVideo;
                const displayImageUrl = hasRealThumbnail ? post.mediaAsset!.thumbnailUrl : (hasImageUrl ? post.mediaAsset!.url : null);
                
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="cursor-pointer p-4 rounded-2xl bg-[#0e0e12]/70 border border-[#22222a] hover:border-red-500/60 flex items-center justify-between gap-4 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#18181f] flex flex-col items-center justify-center">
                        {displayImageUrl ? (
                          <img src={displayImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : isVideo ? (
                          <Play className="w-5 h-5 text-neutral-500" />
                        ) : (
                          <FileText className="w-5 h-5 text-neutral-500" />
                        )}
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-sm md:text-base font-bold text-white line-clamp-1">
                          {post.masterCaption || <span className="text-neutral-500 italic">No caption</span>}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1.5">
                            {post.platformPosts.map((p) => (
                              <PlatformIcon
                                key={p.id}
                                platform={p.platform}
                                size={16}
                                className="w-4 h-4 rounded"
                              />
                            ))}
                          </div>
                          <span className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {post.scheduledFor
                              ? formatTimeInTimeZone(post.scheduledFor, getPostTimezone(post))
                              : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {renderStatusBadge(post.status)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#0e0e12] border border-[#22222a] rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#22222a] mb-6">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-red-500" />
                <h4 className="text-base md:text-lg font-bold text-white">
                  Post Details
                </h4>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white bg-[#18181f]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              
              {/* Media Thumbnail */}
              {selectedPost.mediaAsset && (
                <div className="w-full aspect-video rounded-2xl bg-[#18181f] overflow-hidden border border-[#33333e] flex items-center justify-center relative">
                  {(selectedPost.mediaAsset.thumbnailUrl || (selectedPost.mediaAsset.url && !selectedPost.mediaAsset.mimeType?.startsWith('video/'))) ? (
                    <img 
                      src={selectedPost.mediaAsset.thumbnailUrl || selectedPost.mediaAsset.url} 
                      className="w-full h-full object-cover" 
                      alt="" 
                    />
                  ) : selectedPost.mediaAsset.mimeType?.startsWith('video/') ? (
                    <div className="flex flex-col items-center text-neutral-500">
                      <Play className="w-12 h-12 mb-2" />
                      <span className="text-xs font-bold uppercase">Video Ready</span>
                    </div>
                  ) : (
                    <FileText className="w-12 h-12 text-neutral-600" />
                  )}
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Master Caption
                </span>
                <p className="text-sm md:text-base text-neutral-200 mt-1.5 bg-[#100606]/90 p-4 rounded-2xl border border-[#22222a] leading-relaxed whitespace-pre-wrap">
                  {selectedPost.masterCaption || <span className="text-neutral-500 italic">No caption</span>}
                </p>
              </div>

              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Target Platforms ({selectedPost.platformPosts.length})
                </span>
                <div className="flex flex-col gap-2.5 mt-2">
                  {selectedPost.platformPosts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0e0e12] border border-[#22222a] text-sm font-semibold"
                    >
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={p.platform} size={16} className="w-4 h-4 rounded" />
                        <span className="text-white">{p.socialAccount?.username || p.socialAccount?.name || p.platform}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderStatusBadge(p.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPost.platformPosts.some(p => p.errorMessage) && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                  <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5 mb-1.5">
                    <AlertCircle className="w-4 h-4" /> Errors
                  </span>
                  <div className="space-y-1">
                    {selectedPost.platformPosts.filter(p => p.errorMessage).map(p => (
                      <p key={p.id} className="text-xs font-bold text-red-300">
                        {p.platform}: {p.errorMessage}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#0e0e12]/60 border border-[#22222a]">
                  <span className="text-xs font-semibold text-neutral-400">Scheduled For</span>
                  <p className="text-sm md:text-base font-bold text-white mt-1">
                    {selectedPost.scheduledFor
                      ? `${formatDateInTimeZone(
                          selectedPost.scheduledFor,
                          getPostTimezone(selectedPost)
                        )} at ${formatTimeInTimeZone(
                          selectedPost.scheduledFor,
                          getPostTimezone(selectedPost)
                        )}`
                      : 'N/A'}
                  </p>
                  <p className="text-xs font-bold text-red-400 mt-1">
                    {getTimezoneLabel(getPostTimezone(selectedPost))}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0e0e12]/60 border border-[#22222a]">
                  <span className="text-xs font-semibold text-neutral-400">Global Status</span>
                  <div className="mt-1.5">
                    {renderStatusBadge(selectedPost.status)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3.5 mt-8 pt-5 border-t border-[#22222a]">
              <button
                onClick={() => setSelectedPost(null)}
                className="px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-[#18181f] rounded-xl transition-colors"
              >
                Close
              </button>
              {selectedPost.status.toUpperCase() === 'SCHEDULED' && (
                <Link
                  href="/scheduled"
                  className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md transition-colors"
                >
                  Manage in Queue
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
