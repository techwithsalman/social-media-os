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
    url: string;
    thumbnailUrl?: string;
  } | null;
  platformPosts: Array<{
    id: string;
    platform: string;
    status: string;
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

const pad = (value: number) => String(value).padStart(2, '0');

const getDateKeyFromParts = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

const getPostTimezone = (post: PostItem) => post.timezone || WORKSPACE_TIMEZONE;

const getPostDateKey = (post: PostItem) =>
  post.scheduledFor
    ? getDateKeyInTimeZone(post.scheduledFor, getPostTimezone(post))
    : null;

export default function ContentCalendarPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK' | 'DAY'>('MONTH');
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    getTodayDateKey(WORKSPACE_TIMEZONE)
  );
  const [currentDate, setCurrentDate] = useState(() =>
    createDateFromDateKey(getTodayDateKey(WORKSPACE_TIMEZONE))
  );
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDate = params.get('date');
    const initialDateKey =
      requestedDate && isValidDateKey(requestedDate)
        ? requestedDate
        : getTodayDateKey(WORKSPACE_TIMEZONE);

    setSelectedDateKey(initialDateKey);
    setCurrentDate(createDateFromDateKey(initialDateKey));
  }, []);

  useEffect(() => {
    async function loadPosts() {
      try {
        setLoading(true);
        const res = await fetch('/api/posts');
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayKey = getTodayDateKey(WORKSPACE_TIMEZONE);
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = useMemo(() => {
    const days: Array<number | null> = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [daysInMonth, firstDayIndex]);

  const selectedDatePosts = posts.filter((post) => getPostDateKey(post) === selectedDateKey);

  const setCalendarDate = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setCurrentDate(createDateFromDateKey(dateKey));
    router.push(`/calendar?date=${dateKey}`);
  };

  const handlePrev = () => {
    const next = new Date(year, month - 1, 1);
    setCalendarDate(getDateKeyFromParts(next.getFullYear(), next.getMonth(), 1));
  };

  const handleNext = () => {
    const next = new Date(year, month + 1, 1);
    setCalendarDate(getDateKeyFromParts(next.getFullYear(), next.getMonth(), 1));
  };

  const handleToday = () => {
    setCalendarDate(todayKey);
  };

  return (
    <AppLayout title="Content Calendar">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-neutral-400 hover:text-white transition-colors border border-[#22222a] rounded-lg bg-[#0e0e12]">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-black text-white tracking-tight">Content Calendar</h1>
      </div>

      {/* Hero Banner */}
      <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-r from-[#170505] via-[#3a0508] to-[#120202] border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.1)] relative overflow-hidden mb-8 group">
        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-red-600/15 to-transparent pointer-events-none blur-[50px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-950/50 shrink-0 border border-red-400/20">
            <CalendarIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">Content Calendar</h2>
            <p className="text-sm md:text-base text-neutral-300 font-medium mt-1">Plan, <span className="text-red-400">manage</span>, and schedule your content across all connected platforms.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePrev}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0e0e12] hover:bg-[#18181f] text-sm font-bold text-neutral-200 border border-[#22222a] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleToday}
            className="px-4 py-2.5 rounded-xl bg-[#18181f] hover:bg-[#2a1010] text-sm font-bold text-neutral-200 border border-[#33333e] transition-colors"
          >
            Today
          </button>

          <div className="px-5 py-2.5 rounded-xl bg-[#0e0e12] border border-[#22222a] text-base md:text-lg font-black text-white min-w-[190px] text-center shadow-sm">
            {monthNames[month]} {year}
          </div>

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0e0e12] hover:bg-[#18181f] text-sm font-bold text-neutral-200 border border-[#22222a] transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#0e0e12] border border-[#22222a] rounded-2xl p-1.5 text-sm font-bold shadow-sm">
            {(['MONTH', 'WEEK', 'DAY'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-xl transition-all ${
                  viewMode === mode
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {mode.charAt(0) + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <Link
            href="/create-post"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule</span>
          </Link>
        </div>
      </div>

      {viewMode === 'MONTH' && (
        <div className="bg-transparent border border-red-500/10 rounded-[32px] overflow-hidden shadow-md p-2">
          <div className="grid grid-cols-7 text-xs md:text-sm font-bold text-neutral-400 text-center py-4 px-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 auto-rows-fr gap-1 p-1">
            {calendarDays.map((dayNum, idx) => {
              if (!dayNum) {
                return (
                  <div
                    key={`empty_${idx}`}
                    className="min-h-[140px] p-3 opacity-40 bg-[#0b0c10]/20 rounded-2xl m-0.5"
                  />
                );
              }

              const dateKey = getDateKeyFromParts(year, month, dayNum);
              const dayPosts = posts.filter((post) => getPostDateKey(post) === dateKey);
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDateKey;
              const hasPosts = dayPosts.length > 0;

              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={`day_${dateKey}`}
                  data-date-key={dateKey}
                  data-is-today={isToday ? 'true' : 'false'}
                  data-is-selected={isSelected ? 'true' : 'false'}
                  data-has-posts={hasPosts ? 'true' : 'false'}
                  onClick={() => setCalendarDate(dateKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setCalendarDate(dateKey);
                  }}
                  className={`relative overflow-hidden min-h-[140px] p-3 flex flex-col justify-between text-left transition-all border border-red-500/10 rounded-2xl m-0.5 group ${
                    isToday ? 'bg-[#180505] border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.15)] ring-1 ring-red-500/50' 
                    : isSelected ? 'bg-[#180505] border-red-500/30 ring-1 ring-red-500/30'
                    : 'bg-[#0f0f13] hover:bg-[#15151a]'
                  }`}
                >
                  {isToday && (
                    <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-red-600/30 blur-[20px] rounded-full pointer-events-none" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="relative z-10 flex items-center justify-between mb-2">
                    <span
                      className={`text-sm font-bold ${
                        isToday
                          ? 'w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-900/50'
                          : isSelected
                          ? 'text-red-400'
                          : 'text-neutral-400'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {hasPosts && (
                      <span className="text-xs font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded-md border border-red-500/30">
                        {dayPosts.length} post{dayPosts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[90px]">
                    {dayPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPost(post);
                        }}
                        className="cursor-pointer p-2 rounded-xl bg-[#100606]/90 border border-[#22222a] hover:border-red-500/60 text-xs flex items-center gap-2 transition-all truncate shadow-sm"
                      >
                        <div className="flex items-center gap-1 shrink-0">
                          {post.platformPosts.slice(0, 3).map((p) => (
                            <PlatformIcon
                              key={p.id}
                              platform={p.platform}
                              size={14}
                              className="w-3.5 h-3.5 rounded"
                            />
                          ))}
                        </div>
                        <span className="text-neutral-100 truncate font-semibold">
                          {post.masterCaption}
                        </span>
                      </div>
                    ))}
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
              selectedDatePosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="cursor-pointer p-5 rounded-2xl bg-[#0e0e12]/70 border border-[#22222a] hover:border-red-500/60 flex items-center justify-between gap-4 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <Clock className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm md:text-base font-bold text-white line-clamp-1">
                        {post.masterCaption}
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
                        <span className="text-xs text-neutral-400 font-semibold">
                          {post.scheduledFor
                            ? formatTimeInTimeZone(post.scheduledFor, getPostTimezone(post))
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold border border-red-500/30">
                    {post.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#0e0e12] border border-[#22222a] rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#22222a] mb-6">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-red-500" />
                <h4 className="text-base md:text-lg font-bold text-white">
                  Scheduled Post Details
                </h4>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Master Caption
                </span>
                <p className="text-sm md:text-base text-neutral-200 mt-1.5 bg-[#100606]/90 p-4 rounded-2xl border border-[#22222a] leading-relaxed">
                  {selectedPost.masterCaption}
                </p>
              </div>

              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Target Platforms ({selectedPost.platformPosts.length})
                </span>
                <div className="flex flex-wrap gap-2.5 mt-2">
                  {selectedPost.platformPosts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0e0e12] border border-[#22222a] text-sm font-semibold"
                    >
                      <PlatformIcon platform={p.platform} size={16} className="w-4 h-4 rounded" />
                      <span className="text-white">{p.platform}</span>
                    </div>
                  ))}
                </div>
              </div>

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
                  <span className="text-xs font-semibold text-neutral-400">Queue Status</span>
                  <p className="text-sm md:text-base font-bold text-red-500 mt-1">
                    {selectedPost.status}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3.5 mt-8 pt-5 border-t border-[#22222a]">
              <button
                onClick={() => setSelectedPost(null)}
                className="px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-[#18181f] rounded-xl"
              >
                Close
              </button>
              <Link
                href="/scheduled"
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md"
              >
                Manage in Scheduled Posts
              </Link>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
