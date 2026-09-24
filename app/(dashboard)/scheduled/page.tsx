'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
  XCircle,
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
  } | null;
  platformPosts: Array<{
    id: string;
    socialAccountId: string;
    platform: string;
    status: string;
    customCaption?: string | null;
    hashtags?: string | null;
    contentType?: string | null;
    visibility?: string | null;
    metadata?: string | null;
    socialAccount?: {
      id: string;
      name: string;
      username: string;
    };
  }>;
}

const getPostTimezone = (post: ScheduledPostItem) => post.timezone || WORKSPACE_TIMEZONE;

const getPostCalendarDate = (post: ScheduledPostItem) =>
  post.scheduledFor
    ? getDateKeyInTimeZone(post.scheduledFor, getPostTimezone(post))
    : getTodayDateKey(WORKSPACE_TIMEZONE);

const parseMetadata = (metadata?: string | null) => {
  if (!metadata) return {};

  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
};

export default function ScheduledPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<ScheduledPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');

  const [reschedulePostId, setReschedulePostId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(() => getTodayDateKey(WORKSPACE_TIMEZONE));
  const [newTime, setNewTime] = useState('');
  const [newTimezone, setNewTimezone] = useState(WORKSPACE_TIMEZONE);
  const rescheduleDateInputRef = useRef<HTMLInputElement | null>(null);
  const rescheduleTimeInputRef = useRef<HTMLInputElement | null>(null);
  const rescheduleTimezoneSelectRef = useRef<HTMLSelectElement | null>(null);

  const fetchScheduled = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/posts?status=SCHEDULED');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
  }, []);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  const handlePublishNow = async (postId: string) => {
    try {
      setActionLoadingId(postId);
      setErrorMessage('');
      const res = await fetch(`/api/posts/${postId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish post.');

      showSuccess('Post published successfully across all platform accounts!');
      fetchScheduled();
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to publish post.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (postId: string) => {
    if (!confirm('Cancel this scheduled post? It will remain in history but leave the queue.')) return;

    try {
      setActionLoadingId(postId);
      setErrorMessage('');
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel post.');

      setPosts((prev) => prev.filter((post) => post.id !== postId));
      showSuccess('Scheduled post cancelled.');
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to cancel post.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this scheduled post permanently?')) return;

    try {
      setActionLoadingId(postId);
      setErrorMessage('');
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete post.');

      setPosts((prev) => prev.filter((post) => post.id !== postId));
      showSuccess('Scheduled post deleted.');
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to delete post.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicate = async (post: ScheduledPostItem) => {
    try {
      setActionLoadingId(post.id);
      setErrorMessage('');
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
            hashtags: platformPost.hashtags,
            contentType: platformPost.contentType || 'POST',
            visibility: platformPost.visibility || 'PUBLIC',
            metadata: parseMetadata(platformPost.metadata),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to duplicate post.');

      showSuccess('Draft duplicate created.');
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to duplicate post.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRescheduleModal = (post: ScheduledPostItem) => {
    const postTimezone = getPostTimezone(post);
    setReschedulePostId(post.id);
    setRescheduleError('');
    setNewTimezone(postTimezone);

    if (post.scheduledFor) {
      setNewDate(getDateKeyInTimeZone(post.scheduledFor, postTimezone));
      setNewTime(formatTimeInputInTimeZone(post.scheduledFor, postTimezone));
    } else {
      setNewDate(getTodayDateKey(WORKSPACE_TIMEZONE));
      setNewTime('');
    }
  };

  const getRescheduleInputValues = () => ({
    date: rescheduleDateInputRef.current?.value || newDate,
    time: rescheduleTimeInputRef.current?.value || newTime,
    timezone: rescheduleTimezoneSelectRef.current?.value || newTimezone,
  });

  const handleRescheduleSubmit = async () => {
    if (!reschedulePostId) return;

    const { date, time, timezone } = getRescheduleInputValues();
    setNewDate(date);
    setNewTime(time);
    setNewTimezone(timezone);

    if (!date) {
      setRescheduleError('Publish Date is required.');
      return;
    }

    if (!time) {
      setRescheduleError('Publish Time is required.');
      return;
    }

    try {
      setActionLoadingId(reschedulePostId);
      setErrorMessage('');
      setRescheduleError('');
      const scheduledFor = zonedDateTimeToUtcIso(date, time, timezone);
      const res = await fetch(`/api/posts/${reschedulePostId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor, timezone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reschedule post.');

      setReschedulePostId(null);
      showSuccess('Post rescheduled successfully!');
      fetchScheduled();
    } catch (e: any) {
      setRescheduleError(e.message || 'Failed to reschedule post.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AppLayout title="Scheduled Posts Queue">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Scheduled Posts ({posts.length})
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1.5">
            Manage, reschedule, or immediately broadcast content queued in your automated calendar.
          </p>
        </div>

        <Link
          href="/create-post"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Scheduled Post</span>
        </Link>
      </div>

      {successMessage && (
        <div className="mb-8 p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-8 p-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-semibold">Loading scheduled queue...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-16 text-center bg-[#0d1322] border border-slate-800 rounded-3xl">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">No posts in the schedule queue</h3>
          <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
            You don&apos;t have any posts queued for future broadcast. Create a post or seed sample demo data.
          </p>
          <Link
            href="/create-post"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Create Scheduled Post</span>
          </Link>
        </div>
      ) : (
        <div className="bg-[#0d1322] border border-slate-800 rounded-3xl overflow-hidden shadow-md">
          <div className="divide-y divide-slate-800">
            {posts.map((post) => {
              const postTimezone = getPostTimezone(post);
              const disabled = actionLoadingId === post.id;

              return (
                <div
                  key={post.id}
                  data-scheduled-post-row={post.id}
                  className="p-6 md:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6 hover:bg-slate-900/40 transition-colors"
                >
                  <div className="flex items-start gap-5 min-w-0">
                    <div className="w-24 h-24 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                      {post.mediaAsset?.thumbnailUrl || post.mediaAsset?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.mediaAsset.thumbnailUrl || post.mediaAsset.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-600" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-base md:text-lg font-bold text-white line-clamp-2 leading-relaxed">
                        {post.masterCaption}
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5 mt-3">
                        {post.platformPosts.map((platformPost) => (
                          <span
                            key={platformPost.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200"
                          >
                            <PlatformIcon
                              platform={platformPost.platform}
                              size={15}
                              className="w-3.5 h-3.5 rounded"
                            />
                            {platformPost.platform}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Date
                          </span>
                          <p className="text-sm font-bold text-white mt-0.5">
                            {post.scheduledFor
                              ? formatDateInTimeZone(post.scheduledFor, postTimezone)
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Time
                          </span>
                          <p className="text-sm font-bold text-indigo-300 mt-0.5">
                            {post.scheduledFor
                              ? formatTimeInTimeZone(post.scheduledFor, postTimezone)
                              : 'N/A'}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Timezone
                          </span>
                          <p className="text-sm font-bold text-slate-200 mt-0.5">
                            {getTimezoneLabel(postTimezone)}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Status
                          </span>
                          <p className="text-sm font-black text-emerald-300 mt-0.5">
                            {post.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap xl:justify-end gap-2.5 shrink-0 pt-5 xl:pt-0 border-t xl:border-t-0 border-slate-800">
                    <button
                      data-post-action="edit"
                      onClick={() => router.push(`/create-post?edit=${post.id}`)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <Pencil className="w-4 h-4" />
                      <span>Edit</span>
                    </button>

                    <button
                      data-post-action="reschedule"
                      onClick={() => openRescheduleModal(post)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-500/30 text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Reschedule</span>
                    </button>

                    <button
                      data-post-action="duplicate"
                      onClick={() => handleDuplicate(post)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      data-post-action="publish-now"
                      onClick={() => handlePublishNow(post.id)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>Publish Now</span>
                    </button>

                    <button
                      data-post-action="cancel"
                      onClick={() => handleCancel(post.id)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>

                    <button
                      data-post-action="view-calendar"
                      onClick={() => router.push(`/calendar?date=${getPostCalendarDate(post)}`)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>View in Calendar</span>
                    </button>

                    <button
                      data-post-action="delete"
                      onClick={() => handleDelete(post.id)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent text-xs md:text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reschedulePostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0d1322] border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h4 className="text-base md:text-lg font-bold text-white">Reschedule Content</h4>
              </div>
              <button
                onClick={() => {
                  setReschedulePostId(null);
                  setRescheduleError('');
                }}
                className="text-slate-400 hover:text-white"
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
                <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">
                  Publish Date
                </label>
                <input
                  ref={rescheduleDateInputRef}
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">
                  Publish Time
                </label>
                <input
                  ref={rescheduleTimeInputRef}
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">
                  Timezone
                </label>
                <select
                  ref={rescheduleTimezoneSelectRef}
                  value={newTimezone}
                  onChange={(e) => setNewTimezone(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={actionLoadingId === reschedulePostId}
                className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
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
