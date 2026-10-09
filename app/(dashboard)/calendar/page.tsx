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
    <AppLayout title="Content Calendar">
      <div className="max-w-[1440px] w-full mx-auto">
      {/* Calendar Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-950/40 to-black border border-red-900/30 mb-8 p-6 md:p-10 shadow-[0_0_40px_-15px_rgba(220,38,38,0.15)]">
        <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none opacity-50">
          <div className="absolute -top-[50%] -right-[10%] w-[70%] h-[150%] bg-red-900/10 blur-[100px] rounded-full mix-blend-screen"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[100%] bg-red-950/20 blur-[80px] rounded-full mix-blend-screen"></div>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-black/50 border border-red-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.2)] shrink-0">
            <CalendarIcon className="w-8 h-8 text-red-500 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2 text-neutral-400 text-sm font-bold">
              <Link href="/" className="hover:text-white transition-colors">← Back</Link>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Content Calendar</h1>
            </div>
            <p className="text-red-200/70 max-w-xl text-sm md:text-base">
              Plan, manage, and schedule your content across all connected platforms.
            </p>
          </div>
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

      {/* Calendar Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0">
          <button onClick={handlePrevMonth} className="px-3 py-2 rounded-lg border border-[#22222a] bg-[#0e0e12] hover:bg-[#18181f] text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 font-medium text-sm whitespace-nowrap">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button onClick={handleToday} className="px-4 py-2 rounded-lg border border-[#22222a] bg-[#0e0e12] hover:bg-[#18181f] text-neutral-300 hover:text-white transition-colors font-medium text-sm">
            Today
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-900/30 bg-red-950/20 text-red-100 font-bold whitespace-nowrap">
            <CalendarIcon className="w-4 h-4 text-red-500" />
            {monthNames[month]} {year}
          </div>
          <button onClick={handleNextMonth} className="px-3 py-2 rounded-lg border border-[#22222a] bg-[#0e0e12] hover:bg-[#18181f] text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 font-medium text-sm whitespace-nowrap">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center p-1 rounded-xl bg-[#0e0e12] border border-[#22222a]">
            {(['MONTH', 'WEEK', 'DAY'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  viewMode === mode
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {mode.charAt(0) + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <Link
            href="/create-post"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] ml-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Schedule</span>
          </Link>
        </div>
      </div>

      {viewMode === 'MONTH' && (
        <div className="bg-[#0e0e12] border border-[#22222a] rounded-2xl overflow-hidden shadow-2xl">
          <div className="grid grid-cols-7 border-b border-[#22222a] bg-[#141419]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-3.5 text-center text-[11px] font-bold text-neutral-500 uppercase tracking-widest"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div
                key={`empty-start-${i}`}
                className="min-h-[140px] p-2 border-r border-b border-[#22222a] bg-[#0a0a0c]"
              />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayPosts = postsByDate[dateKey] || [];
              const isToday = dateKey === getTodayDateKey(WORKSPACE_TIMEZONE);

              const displayPosts = dayPosts.slice(0, 3);
              const remainingCount = dayPosts.length - 3;

              return (
                <div
                  key={dateKey}
                  onClick={() => handleDayClick(dateKey)}
                  className={`min-h-[140px] p-2.5 border-r border-b border-[#22222a] cursor-pointer transition-all relative group ${
                    isToday
                      ? 'bg-red-950/10 shadow-[inset_0_0_20px_rgba(220,38,38,0.05)]'
                      : 'hover:bg-[#141419] bg-[#0e0e12]'
                  }`}
                >
                  {isToday && (
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-70"></div>
                  )}
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]'
                          : 'text-neutral-400 group-hover:text-neutral-200'
                      }`}
                    >
                      {day}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {displayPosts.map((post) => {
                       return (
                        <div
                          key={post.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPost(post);
                          }}
                          className="flex items-center gap-1.5 p-1.5 rounded bg-[#18181f] border border-[#2a2a35] hover:border-red-500/50 transition-colors"
                        >
                          <div className="flex -space-x-1 shrink-0">
                            {post.platformPosts.slice(0, 2).map((p, idx) => (
                              <PlatformIcon key={idx} platform={p.platform} size={12} className="w-3.5 h-3.5 rounded-sm ring-1 ring-[#18181f]" />
                            ))}
                            {post.platformPosts.length > 2 && (
                              <div className="w-3.5 h-3.5 rounded-sm ring-1 ring-[#18181f] bg-neutral-800 flex items-center justify-center text-[7px] font-bold text-white z-10">
                                +{post.platformPosts.length - 2}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-300 font-medium truncate flex-1">
                            {post.scheduledFor ? formatTimeInTimeZone(post.scheduledFor, getPostTimezone(post)) : 'Draft'}
                          </span>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            post.status.toUpperCase() === 'PUBLISHED' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' :
                            post.status.toUpperCase() === 'SCHEDULED' ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]' :
                            post.status.toUpperCase() === 'FAILED' ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-neutral-500'
                          }`} />
                        </div>
                       )
                    })}
                    {remainingCount > 0 && (
                      <div className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-300 px-1 mt-1 text-center bg-[#141419] rounded py-1 border border-transparent">
                        +{remainingCount} more
                      </div>
                    )}
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
          </div>
    </AppLayout>
  );
}
