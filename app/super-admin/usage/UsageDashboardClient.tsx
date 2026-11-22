'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  WalletCards,
  HardDrive,
  Clock,
  AlertTriangle,
  Video,
  Image as ImageIcon,
  Search,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Shield,
  Layers,
  BarChart3,
  RefreshCw,
  FolderArchive,
  Database,
  FileText,
} from 'lucide-react';
import {
  UserUsageItem,
  SuperAdminUsageSummary,
  GlobalStorageOverview,
} from '@/lib/usage-analytics';

interface Props {
  initialSummary: SuperAdminUsageSummary;
  initialUsers: UserUsageItem[];
  initialStorage: GlobalStorageOverview;
}

export function UsageDashboardClient({
  initialSummary,
  initialUsers,
  initialStorage,
}: Props) {
  const [activeTab, setActiveTab] = useState<'users' | 'platforms' | 'storage'>('users');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'storage' | 'posts' | 'published' | 'scheduled' | 'videos'>('storage');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [users, setUsers] = useState<UserUsageItem[]>(initialUsers);
  const [summary, setSummary] = useState<SuperAdminUsageSummary>(initialSummary);
  const [storageOverview, setStorageOverview] = useState<GlobalStorageOverview>(initialStorage);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const [usageRes, storageRes] = await Promise.all([
        fetch(`/api/super-admin/usage?search=${encodeURIComponent(search)}&sortBy=${sortBy}&order=${sortOrder}`),
        fetch('/api/super-admin/storage'),
      ]);
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsers(usageData.users);
        setSummary(usageData.summary);
      }
      if (storageRes.ok) {
        const stData = await storageRes.json();
        setStorageOverview(stData);
      }
    } catch (err) {
      console.error('Failed to refresh analytics data', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSortChange = (newSort: 'storage' | 'posts' | 'published' | 'scheduled' | 'videos') => {
    if (sortBy === newSort) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(newSort);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    let list = [...users];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.workspace && u.workspace.name.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case 'storage':
          diff = a.storage.activeBytes - b.storage.activeBytes;
          break;
        case 'posts':
          diff = a.posts.total - b.posts.total;
          break;
        case 'published':
          diff = a.posts.published - b.posts.published;
          break;
        case 'scheduled':
          diff = a.posts.scheduled - b.posts.scheduled;
          break;
        case 'videos':
          diff = a.storage.videoFiles - b.storage.videoFiles;
          break;
        default:
          diff = a.storage.activeBytes - b.storage.activeBytes;
      }
      return sortOrder === 'desc' ? -diff : diff;
    });

    return list;
  }, [users, search, sortBy, sortOrder]);

  // Aggregated platform totals across all users
  const platformSummary = useMemo(() => {
    const plats: Record<string, { total: number; published: number; scheduled: number; failed: number }> = {
      YOUTUBE: { total: 0, published: 0, scheduled: 0, failed: 0 },
      TIKTOK: { total: 0, published: 0, scheduled: 0, failed: 0 },
      FACEBOOK: { total: 0, published: 0, scheduled: 0, failed: 0 },
      INSTAGRAM: { total: 0, published: 0, scheduled: 0, failed: 0 },
      LINKEDIN: { total: 0, published: 0, scheduled: 0, failed: 0 },
      X: { total: 0, published: 0, scheduled: 0, failed: 0 },
      PINTEREST: { total: 0, published: 0, scheduled: 0, failed: 0 },
      SNAPCHAT: { total: 0, published: 0, scheduled: 0, failed: 0 },
    };

    for (const u of users) {
      if (u.platforms) {
        for (const [pName, pStats] of Object.entries(u.platforms)) {
          if (!plats[pName]) {
            plats[pName] = { total: 0, published: 0, scheduled: 0, failed: 0 };
          }
          plats[pName].total += pStats.total;
          plats[pName].published += pStats.published;
          plats[pName].scheduled += pStats.scheduled;
          plats[pName].failed += pStats.failed;
        }
      }
    }
    return plats;
  }, [users]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
            <BarChart3 className="w-4 h-4" />
            <span>Real-Time SaaS Intelligence</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mt-1">
            User Usage & Storage Analytics
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
            Audit live user activity, unique content posts, platform publishing attempts, and Cloudflare R2 storage consumption per workspace.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin/storage"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>R2 Cleanup & Audit</span>
          </Link>
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#160a0a] hover:bg-[#251010] border border-[#3a1515] text-amber-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {/* Top Summary Cards (Requirement 5) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Total Users</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-white mt-2">{summary.totalUsers}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1 font-semibold">
            <span className="text-emerald-400 font-bold">{summary.activeUsers} Active</span>
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Paid vs Free</span>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-white mt-2 flex items-center gap-1.5">
            <span className="text-purple-300">{summary.paidUsers} Paid</span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            <span>{summary.freeUsers} Free Users</span>
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Workspaces</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-white mt-2">{summary.totalWorkspaces}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Registered workspaces
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Total Posts</span>
            <WalletCards className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-white mt-2">{summary.totalPosts}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            {summary.totalDraftPosts} in drafts
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Published Posts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-300 mt-2">{summary.totalPublishedPosts}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Published to social
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Scheduled</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-black text-blue-300 mt-2">{summary.totalScheduledPosts}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Queued for publishing
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Failed Posts</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-black text-red-400 mt-2">{summary.totalFailedPosts}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Publish errors
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Videos Uploaded</span>
            <Video className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-300 mt-2">{summary.totalVideosUploaded}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Across {summary.totalMediaFiles} total files
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">R2 Storage (GB)</span>
            <HardDrive className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-black text-teal-300 mt-2">
            {summary.totalStorageGB} GB
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center justify-between font-semibold">
            <span>{summary.totalStorageMB} MB active</span>
            <span
              className={`px-1 rounded text-[9px] font-black uppercase ${
                summary.storageWarningLevel === 'HEALTHY'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : summary.storageWarningLevel === 'WARNING'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {summary.storageWarningLevel}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Storage Saved</span>
            <FolderArchive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-300 mt-2">{summary.storageSavedArchivedGB} GB</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Freed post-publish
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">10 GB Quota</span>
            <BarChart3 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-black text-white mt-2">{summary.storagePercentageUsed}%</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            of free 10 GB tier
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Drafts</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-300 mt-2">{summary.totalDraftPosts}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Unpublished drafts
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-[#2a1010] gap-4">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Usage & Storage Table</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-[#1a0a0a] border border-[#3a1515] text-neutral-300">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('platforms')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'platforms'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Platform-Wise Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'storage'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Cloudflare R2 Storage Monitor</span>
        </button>
      </div>

      {/* Tab 1: User Usage & Storage Table */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls: Search and Sorters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0a0404] border border-[#2a1010] p-4 rounded-2xl">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search by user, email, or workspace..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#050202] border border-[#2a1010] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-neutral-400 whitespace-nowrap">Sort by:</span>
              <button
                onClick={() => handleSortChange('storage')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  sortBy === 'storage'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
                }`}
              >
                <span>Storage</span>
                {sortBy === 'storage' && <ArrowUpDown className="w-3 h-3" />}
              </button>
              <button
                onClick={() => handleSortChange('posts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  sortBy === 'posts'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
                }`}
              >
                <span>Total Posts</span>
                {sortBy === 'posts' && <ArrowUpDown className="w-3 h-3" />}
              </button>
              <button
                onClick={() => handleSortChange('published')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  sortBy === 'published'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
                }`}
              >
                <span>Published</span>
                {sortBy === 'published' && <ArrowUpDown className="w-3 h-3" />}
              </button>
              <button
                onClick={() => handleSortChange('scheduled')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  sortBy === 'scheduled'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
                }`}
              >
                <span>Scheduled</span>
                {sortBy === 'scheduled' && <ArrowUpDown className="w-3 h-3" />}
              </button>
              <button
                onClick={() => handleSortChange('videos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  sortBy === 'videos'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
                }`}
              >
                <span>Videos</span>
                {sortBy === 'videos' && <ArrowUpDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#0a0404] border border-[#2a1010] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2a1010] bg-[#050202]">
                    <th className="px-5 py-3.5 text-xs font-black text-neutral-400 uppercase tracking-wider">User & Workspace</th>
                    <th className="px-5 py-3.5 text-xs font-black text-neutral-400 uppercase tracking-wider">Plan & Status</th>
                    <th className="px-5 py-3.5 text-xs font-black text-neutral-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSortChange('storage')}>
                        <span>R2 Storage</span>
                        <ArrowUpDown className="w-3 h-3 text-neutral-500" />
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-xs font-black text-neutral-400 uppercase tracking-wider">Media Files</th>
                    <th className="px-5 py-3.5 text-xs font-black text-neutral-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSortChange('posts')}>
                        <span>Content Posts</span>
                        <ArrowUpDown className="w-3 h-3 text-neutral-500" />
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-xs font-black text-neutral-400 uppercase tracking-wider">Platforms</th>
                    <th className="px-5 py-3.5 text-xs font-black text-neutral-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a1010]/50 text-sm">
                  {filteredAndSortedUsers.map((item) => (
                    <tr key={item.id} className="hover:bg-[#160808]/40 transition-colors">
                      {/* User & Workspace */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-200">
                            {item.name ? item.name[0]?.toUpperCase() : item.email[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.systemRole === 'SUPER_ADMIN' && (
                                <Shield className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </div>
                            <div className="text-xs text-neutral-400 font-medium">{item.email}</div>
                            {item.workspace ? (
                              <div className="text-[11px] text-amber-400/80 font-semibold mt-0.5">
                                WS: {item.workspace.name}
                              </div>
                            ) : (
                              <div className="text-[11px] text-neutral-600">No workspace</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plan & Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300">
                          {item.plan.code}
                        </span>
                        <div className="mt-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </td>

                      {/* R2 Storage */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-black text-white">
                          {item.storage.activeMB >= 1024
                            ? `${item.storage.activeGB} GB`
                            : `${item.storage.activeMB} MB`}
                        </div>
                        {item.storage.percentageUsed !== null ? (
                          <div className="mt-1.5 w-24">
                            <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.storage.percentageUsed > 90
                                    ? 'bg-red-500'
                                    : item.storage.percentageUsed > 75
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, item.storage.percentageUsed)}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-neutral-500 font-semibold mt-0.5">
                              {item.storage.percentageUsed}% of limit
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-500 font-medium">Unlimited</span>
                        )}
                      </td>

                      {/* Media Files */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1 text-rose-300 font-semibold">
                            <Video className="w-3.5 h-3.5" />
                            <span>{item.storage.videoFiles} vids</span>
                          </div>
                          <div className="flex items-center gap-1 text-sky-300 font-semibold">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>{item.storage.imageFiles} imgs</span>
                          </div>
                        </div>
                        {item.storage.archivedFiles > 0 && (
                          <div className="text-[10px] text-neutral-500 mt-1">
                            +{item.storage.archivedFiles} cleaned up from R2
                          </div>
                        )}
                      </td>

                      {/* Content Posts */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{item.posts.total} total</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <span className="text-emerald-400 font-semibold">{item.posts.published} pub</span>
                          <span className="text-neutral-600">•</span>
                          <span className="text-blue-400 font-semibold">{item.posts.scheduled} sched</span>
                          {item.posts.failed > 0 && (
                            <>
                              <span className="text-neutral-600">•</span>
                              <span className="text-red-400 font-semibold">{item.posts.failed} fail</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Platforms */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {Object.entries(item.platforms || {})
                            .filter(([_, stats]) => stats.total > 0)
                            .map(([plat, stats]) => (
                              <span
                                key={plat}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1b0d0d] border border-[#3b1717] text-neutral-300"
                                title={`${plat}: ${stats.published} published / ${stats.total} total`}
                              >
                                {plat}: {stats.published}/{stats.total}
                              </span>
                            ))}
                          {Object.values(item.platforms || {}).every((s) => s.total === 0) && (
                            <span className="text-xs text-neutral-600">None</span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-1">
                          {item.connectedAccountsCount} connected account(s)
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/super-admin/usage/${item.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-200 text-xs font-bold transition-all"
                          >
                            <span>Usage Detail</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            href={`/super-admin/users/${item.id}`}
                            className="p-1.5 rounded-lg bg-[#140606] hover:bg-[#251010] border border-[#2a1010] text-neutral-400 hover:text-white transition-all"
                            title="Manage User & Subscription"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredAndSortedUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-neutral-500 font-medium">
                        No users found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Platform-Wise Analytics Grid */}
      {activeTab === 'platforms' && (
        <div className="space-y-6">
          <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl">
            <h3 className="text-lg font-black text-white">Platform Publishing Overview</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Cross-platform breakdown of social publishing activity across the entire platform.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {Object.entries(platformSummary).map(([platformName, stats]) => {
                const successRate =
                  stats.total > 0 ? ((stats.published / stats.total) * 100).toFixed(1) : '0';

                return (
                  <div
                    key={platformName}
                    className="p-5 rounded-xl bg-[#050202] border border-[#2a1010] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                          {platformName}
                        </span>
                        <span className="text-xs font-bold text-neutral-500">
                          {successRate}% Success
                        </span>
                      </div>
                      <div className="text-2xl font-black text-white mt-3">{stats.total}</div>
                      <div className="text-xs text-neutral-400 mt-0.5">Total publishing attempts</div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1a0808] grid grid-cols-3 gap-1 text-center text-xs">
                      <div>
                        <div className="font-bold text-emerald-400">{stats.published}</div>
                        <div className="text-[10px] text-neutral-500">Published</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-400">{stats.scheduled}</div>
                        <div className="text-[10px] text-neutral-500">Scheduled</div>
                      </div>
                      <div>
                        <div className="font-bold text-red-400">{stats.failed}</div>
                        <div className="text-[10px] text-neutral-500">Failed</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Heaviest users per platform */}
          <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl">
            <h3 className="text-lg font-black text-white">Top Active Users by Platform Publishing</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Identify which users publish the highest volume of posts per platform.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {['FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'TIKTOK', 'LINKEDIN', 'X'].map((plat) => {
                const topForPlat = [...users]
                  .filter((u) => u.platforms && u.platforms[plat]?.total > 0)
                  .sort((a, b) => (b.platforms[plat]?.total || 0) - (a.platforms[plat]?.total || 0))
                  .slice(0, 3);

                return (
                  <div key={plat} className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                    <div className="text-xs font-black text-amber-300 uppercase tracking-wider mb-3">
                      {plat} Top Publishers
                    </div>
                    {topForPlat.length === 0 ? (
                      <p className="text-xs text-neutral-600 py-3">No posts published yet for {plat}.</p>
                    ) : (
                      <div className="space-y-2">
                        {topForPlat.map((u, idx) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#110505] border border-[#260c0c]"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-black text-neutral-500 w-4">{idx + 1}.</span>
                              <div>
                                <span className="font-bold text-white">{u.name}</span>
                                <span className="text-neutral-500 ml-1.5">({u.email})</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 font-bold">
                              <span className="text-emerald-400">
                                {u.platforms[plat]?.published} pub
                              </span>
                              <span className="text-neutral-500">
                                / {u.platforms[plat]?.total} total
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cloudflare R2 Storage Monitor */}
      {activeTab === 'storage' && (
        <div className="space-y-6">
          {/* Storage Gauge */}
          <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white">Global Cloudflare R2 Storage Health</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  10 GB Free-Tier threshold monitoring and automated lifecycle status.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-black uppercase border ${
                    summary.storageWarningLevel === 'HEALTHY'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : summary.storageWarningLevel === 'WARNING'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  Status: {summary.storageWarningLevel}
                </span>
                <span className="text-xs font-bold text-neutral-400">
                  {summary.totalStorageGB} GB / 10.00 GB ({summary.storagePercentageUsed}%)
                </span>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="mt-4">
              <div className="h-4 w-full bg-[#180a0a] rounded-full overflow-hidden p-0.5 border border-[#3a1515]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    summary.storagePercentageUsed > 90
                      ? 'bg-red-500'
                      : summary.storagePercentageUsed > 75
                      ? 'bg-amber-500'
                      : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, summary.storagePercentageUsed)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 font-semibold mt-1">
                <span>0 GB</span>
                <span>8 GB (80% Warning)</span>
                <span>9 GB (90% Critical)</span>
                <span>10 GB Limit</span>
              </div>
            </div>

            {/* Storage Metric Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                <div className="text-xs font-bold text-neutral-500">Active R2 Objects</div>
                <div className="text-xl font-black text-white mt-1">
                  {storageOverview.metrics.activeAssetsCount}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                <div className="text-xs font-bold text-neutral-500">Videos in R2</div>
                <div className="text-xl font-black text-rose-300 mt-1">
                  {storageOverview.metrics.videoCount}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                <div className="text-xs font-bold text-neutral-500">Images in R2</div>
                <div className="text-xl font-black text-sky-300 mt-1">
                  {storageOverview.metrics.imageCount}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
                <div className="text-xs font-bold text-neutral-500">Cleaned & Saved</div>
                <div className="text-xl font-black text-amber-300 mt-1">
                  {storageOverview.metrics.savedArchivedGB} GB
                </div>
              </div>
            </div>
          </div>

          {/* Top Storage Consuming Workspaces */}
          <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl">
            <h3 className="text-lg font-black text-white">Top Storage Consuming Workspaces</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Workspaces consuming the largest share of Cloudflare R2 active bucket bytes.
            </p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#2a1010] text-neutral-500 text-xs uppercase">
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4">Owner Email</th>
                    <th className="py-3 px-4">Active R2 Storage</th>
                    <th className="py-3 px-4">Files</th>
                    <th className="py-3 px-4">Videos</th>
                    <th className="py-3 px-4">Images</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a1010]/40">
                  {storageOverview.topWorkspacesByStorage.map((ws, i) => (
                    <tr key={ws.workspaceId} className="hover:bg-[#140606]">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span className="text-neutral-500">{i + 1}.</span>
                        <span>{ws.workspaceName}</span>
                      </td>
                      <td className="py-3 px-4 text-neutral-300 font-medium">{ws.userEmail}</td>
                      <td className="py-3 px-4 font-black text-amber-300">
                        {ws.activeMB >= 1024 ? `${ws.activeGB} GB` : `${ws.activeMB} MB`}
                      </td>
                      <td className="py-3 px-4 text-neutral-400 font-semibold">{ws.filesCount}</td>
                      <td className="py-3 px-4 text-rose-300 font-semibold">{ws.videoCount}</td>
                      <td className="py-3 px-4 text-sky-300 font-semibold">{ws.imageCount}</td>
                    </tr>
                  ))}
                  {storageOverview.topWorkspacesByStorage.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-neutral-500">
                        No storage records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Uploads */}
          <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl">
            <h3 className="text-lg font-black text-white">Recent Media Uploads</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Latest media assets uploaded by users across all workspaces.
            </p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#2a1010] text-neutral-500 uppercase">
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4">MIME Type</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">R2 Status</th>
                    <th className="py-3 px-4">Uploaded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a1010]/40">
                  {storageOverview.recentUploads.map((upload) => (
                    <tr key={upload.id} className="hover:bg-[#140606]">
                      <td className="py-3 px-4 font-bold text-white max-w-[200px] truncate" title={upload.filename}>
                        {upload.originalName || upload.filename}
                      </td>
                      <td className="py-3 px-4 text-neutral-300 font-medium">{upload.workspaceName}</td>
                      <td className="py-3 px-4 text-neutral-400 font-mono">{upload.mimeType}</td>
                      <td className="py-3 px-4 font-semibold text-neutral-200">{upload.sizeFormatted}</td>
                      <td className="py-3 px-4">
                        {upload.isArchived ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-neutral-800 text-neutral-400 border border-neutral-700">
                            CLEANED UP
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            ACTIVE IN R2
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-500">
                        {new Date(upload.createdAt).toLocaleDateString()} {new Date(upload.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                  {storageOverview.recentUploads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-neutral-500">
                        No uploads recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
