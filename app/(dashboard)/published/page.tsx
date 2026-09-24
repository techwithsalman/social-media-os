'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import {
  CheckCircle2,
  Check,
  ExternalLink,
  Copy,
  Calendar,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  FileText,
} from 'lucide-react';

interface PublishedPostItem {
  id: string;
  masterCaption: string;
  publishedAt: string | null;
  status: string;
  mediaAsset?: {
    url: string;
    thumbnailUrl?: string;
  } | null;
  platformPosts: Array<{
    id: string;
    platform: string;
    status: string;
    customCaption?: string | null;
    hashtags?: string | null;
    externalPostUrl?: string | null;
    errorMessage?: string | null;
    socialAccount?: {
      name: string;
      username: string;
    };
  }>;
}

export default function PublishedPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PublishedPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadPublished() {
      try {
        setLoading(true);
        const res = await fetch('/api/posts?status=HISTORY');
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
    loadPublished();
  }, []);

  const [refreshingPostId, setRefreshingPostId] = useState<string | null>(null);

  const handleRefreshPostStatus = async (postId: string) => {
    try {
      setRefreshingPostId(postId);
      const res = await fetch(`/api/posts/${postId}/refresh-status`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.post) {
          setPosts((prev) =>
            prev.map((p) => (p.id === data.post.id ? data.post : p))
          );
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshingPostId(null);
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCaption = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredPosts = posts.filter((post) => {
    if (filterStatus !== 'ALL' && post.status !== filterStatus) return false;
    if (
      searchQuery &&
      !post.masterCaption.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <AppLayout title="Published Posts History">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Published History ({posts.length})
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1.5">
            Live broadcasts, external URLs, and publishing audit trails across all connected channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search published posts..."
              className="pl-10 pr-4 py-2 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-semibold">Loading published records...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="p-16 text-center bg-[#0d1322] border border-slate-800 rounded-3xl">
          <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">No published posts found</h3>
          <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
            Once your scheduled or instant posts are broadcast to social platforms, they will appear here with live permalinks.
          </p>
          <Link
            href="/create-post"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md"
          >
            <span>Publish New Post</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md hover:border-slate-700 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 mb-5">
                <div className="flex items-start gap-5 overflow-hidden">
                  <div className="w-20 h-20 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
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

                  <div>
                    <p className="text-base md:text-lg font-bold text-white leading-relaxed">
                      {post.masterCaption}
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-xs md:text-sm text-slate-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recent'}
                      </span>
                      <span>•</span>
                      <span
                        className={`font-bold ${
                          post.status === 'PUBLISHED'
                            ? 'text-emerald-400'
                            : post.status === 'INBOX_DRAFT'
                            ? 'text-indigo-400'
                            : post.status === 'PROCESSING'
                            ? 'text-amber-400'
                            : post.status === 'PARTIALLY_FAILED'
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {post.status === 'PUBLISHED'
                          ? 'Published Successfully'
                          : post.status === 'INBOX_DRAFT'
                          ? 'Sent to Creator Inbox'
                          : post.status === 'PROCESSING'
                          ? 'Processing'
                          : post.status === 'PARTIALLY_FAILED'
                          ? 'Partially Published'
                          : 'Publishing Failed'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleRefreshPostStatus(post.id)}
                    disabled={refreshingPostId === post.id}
                    title="Refresh Live Status from TikTok API"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${refreshingPostId === post.id ? 'animate-spin' : ''}`} />
                    <span>Check Status</span>
                  </button>
                  <Link
                    href={`/create-post?duplicate=${post.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-bold transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Duplicate</span>
                  </Link>
                </div>
              </div>

              {/* Platform breakdown cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-4 border-t border-slate-800">
                {post.platformPosts.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <PlatformIcon platform={p.platform} size={22} className="w-5.5 h-5.5 rounded-lg shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-bold text-white truncate">{p.platform}</p>
                          {p.socialAccount && (
                            <p className="text-xs text-slate-400 truncate">@{p.socialAccount.username}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                          p.status === 'PUBLISHED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : p.status === 'PROCESSING' || p.status === 'INBOX_DRAFT'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {p.status === 'INBOX_DRAFT' ? 'CREATOR INBOX DRAFT' : p.status}
                      </span>
                    </div>

                    {p.status === 'PUBLISHED' ? (
                      <p className="text-xs text-emerald-400 font-medium">Live broadcast verified</p>
                    ) : p.status === 'PROCESSING' || p.status === 'INBOX_DRAFT' ? (
                      <p className="text-xs text-indigo-300 leading-relaxed bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-900/50 break-words font-medium">
                        {p.errorMessage || 'Sent to TikTok Creator Inbox (Draft)'}
                      </p>
                    ) : (
                      <p className="text-xs text-red-300 leading-relaxed bg-red-950/40 p-2.5 rounded-lg border border-red-900/50 break-words font-mono">
                        {p.errorMessage || 'Publishing failed on platform API'}
                      </p>
                    )}

                    {p.platform === 'TIKTOK' && (p.status === 'INBOX_DRAFT' || p.status === 'PROCESSING') && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Caption & Hashtags:
                          </span>
                          <button
                            onClick={() =>
                              handleCopyCaption(
                                `${p.customCaption || post.masterCaption || ''} ${p.hashtags || ''}`.trim(),
                                p.id
                              )
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all"
                          >
                            {copiedId === p.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-300">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Caption</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-slate-300 bg-slate-900/80 p-2 rounded-lg font-mono line-clamp-2">
                          {`${p.customCaption || post.masterCaption || ''} ${p.hashtags || ''}`.trim() || 'No caption set'}
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed italic">
                          💡 <strong className="text-slate-300">TikTok Note:</strong> Creator Inbox transfers video files to your mobile app. TikTok's Creator Inbox API does not pre-fill captions automatically. Copy caption above & paste into TikTok before sharing.
                        </p>
                      </div>
                    )}

                    {p.externalPostUrl && (
                      <a
                        href={p.externalPostUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors border border-indigo-500/20 self-start mt-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
