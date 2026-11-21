'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  BarChart3,
  HardDrive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Video,
  Image as ImageIcon,
  FolderArchive,
  Calendar,
  ExternalLink,
  Layers,
  Share2,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { UserUsageDetail } from '@/lib/usage-analytics';

interface Props {
  initialDetail: UserUsageDetail;
}

export function UserUsageDetailClient({ initialDetail }: Props) {
  const [detail, setDetail] = useState<UserUsageDetail>(initialDetail);
  const [dateRange, setDateRange] = useState<string>(initialDetail.dateRange || 'all');
  const [activeSection, setActiveSection] = useState<'recent' | 'scheduled' | 'failed' | 'uploads'>('recent');
  const [isLoading, setIsLoading] = useState(false);

  const handleRangeChange = async (newRange: string) => {
    setDateRange(newRange);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/usage/${detail.user.id}?range=${newRange}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data.detail);
      }
    } catch (err) {
      console.error('Failed to fetch filtered details', err);
    } finally {
      setIsLoading(false);
    }
  };

  const ranges = [
    { label: 'All Time', value: 'all' },
    { label: 'This Month', value: 'month' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Today', value: 'today' },
  ];

  return (
    <div className="space-y-8">
      {/* Navigation and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/super-admin/usage"
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-amber-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Usage & Storage Dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/super-admin/users/${detail.user.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#140606] hover:bg-[#200a0a] border border-[#2a1010] text-neutral-300 hover:text-white text-xs font-bold transition-all"
          >
            <span>Manage User & Subscription</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Profile & Workspace Header Card */}
      <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 flex items-center justify-center font-black text-2xl text-amber-200 shadow-lg">
            {detail.user.firstName ? detail.user.firstName[0]?.toUpperCase() : detail.user.email[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">
                {detail.user.firstName} {detail.user.lastName}
              </h1>
              {detail.user.systemRole === 'SUPER_ADMIN' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  <Shield className="w-3.5 h-3.5" />
                  <span>SUPER ADMIN</span>
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-400 font-medium mt-0.5">{detail.user.email}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 mt-2 font-semibold">
              <span>Member since: {new Date(detail.user.createdAt).toLocaleDateString()}</span>
              {detail.workspace && (
                <>
                  <span>•</span>
                  <span className="text-amber-400">Workspace: {detail.workspace.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Plan & Status Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#050202] border border-[#2a1010] text-center">
            <div className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Plan Tier</div>
            <div className="text-sm font-black text-amber-300 mt-0.5">{detail.plan.name}</div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-[#050202] border border-[#2a1010] text-center">
            <div className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Account Status</div>
            <div
              className={`text-sm font-black mt-0.5 ${
                detail.user.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {detail.user.status}
            </div>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a0404] border border-[#2a1010] px-4 py-3 rounded-2xl">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-400">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>Analytics Time Window:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => handleRangeChange(r.value)}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateRange === r.value
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35 shadow-sm'
                  : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
              }`}
            >
              {r.label}
            </button>
          ))}
          {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 ml-2" />}
        </div>
      </div>

      {/* KPI Cards for the Selected Window */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-[#0a0404] border border-[#2a1010]">
          <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Posts Created</span>
          <div className="text-xl font-black text-white mt-2">{detail.summary.postsCreated}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Unique content</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0404] border border-[#2a1010]">
          <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Published</span>
          <div className="text-xl font-black text-emerald-400 mt-2">{detail.summary.postsPublished}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Successfully sent</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0404] border border-[#2a1010]">
          <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Scheduled</span>
          <div className="text-xl font-black text-blue-400 mt-2">{detail.summary.postsScheduled}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">In publishing queue</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0404] border border-[#2a1010]">
          <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Failed</span>
          <div className="text-xl font-black text-red-400 mt-2">{detail.summary.postsFailed}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Publish errors</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0404] border border-[#2a1010]">
          <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Videos Uploaded</span>
          <div className="text-xl font-black text-rose-300 mt-2">{detail.summary.videosUploaded}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">{detail.summary.imagesUploaded} images</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0404] border border-[#2a1010]">
          <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Active Storage</span>
          <div className="text-xl font-black text-teal-300 mt-2">
            {detail.summary.activeStorageMB >= 1024
              ? `${detail.summary.activeStorageGB} GB`
              : `${detail.summary.activeStorageMB} MB`}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            {detail.summary.storagePercentageUsed !== null ? `${detail.summary.storagePercentageUsed}% used` : 'Unlimited'}
          </div>
        </div>
      </div>

      {/* Platform-Wise Posting Analytics (Requirement 2 & 4) */}
      <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#2a1010]">
          <div>
            <h3 className="text-lg font-black text-white">Platform-Wise Publishing Statistics</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Separate metrics per social network for this user.
            </p>
          </div>
          <div className="text-xs font-bold text-neutral-500">
            Total attempts: {detail.summary.platformAttempts}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {Object.entries(detail.platformBreakdown).map(([platformName, stats]) => (
            <div
              key={platformName}
              className="p-4 rounded-xl bg-[#050202] border border-[#2a1010] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                    {platformName}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-500">
                    {stats.successRate}%
                  </span>
                </div>
                <div className="text-xl font-black text-white mt-2">{stats.total}</div>
                <div className="text-[10px] text-neutral-500">Platform posts</div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#180808] flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-bold">{stats.published} pub</span>
                <span className="text-blue-400 font-bold">{stats.scheduled} sched</span>
                <span className="text-red-400 font-bold">{stats.failed} fail</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connected Accounts & Storage Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connected Social Accounts */}
        <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl">
          <h3 className="text-base font-black text-white">Connected Social Accounts</h3>
          <p className="text-xs text-neutral-400 mt-1">
            Accounts linked to this user's workspace.
          </p>

          <div className="space-y-2 mt-4">
            {detail.connectedAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#050202] border border-[#2a1010] text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#180808] border border-[#301010] text-amber-300">
                    {acc.platform}
                  </span>
                  <div>
                    <div className="font-bold text-white">{acc.name}</div>
                    <div className="text-neutral-500 font-mono">@{acc.username}</div>
                  </div>
                </div>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      acc.status === 'CONNECTED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {acc.status}
                  </span>
                </div>
              </div>
            ))}
            {detail.connectedAccounts.length === 0 && (
              <p className="text-xs text-neutral-600 py-6 text-center">No social accounts connected yet.</p>
            )}
          </div>
        </div>

        {/* Storage Details */}
        <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-white">Cloudflare R2 Storage Allocation</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Active media objects stored in R2 bucket for this workspace.
            </p>

            <div className="mt-4 p-4 rounded-xl bg-[#050202] border border-[#2a1010]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-neutral-400">Storage Used:</span>
                <span className="text-white font-mono">
                  {detail.summary.activeStorageMB} MB
                  {detail.plan.storageLimitMB ? ` / ${detail.plan.storageLimitMB} MB` : ' (Unlimited)'}
                </span>
              </div>
              {detail.summary.storagePercentageUsed !== null && (
                <div className="mt-3">
                  <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        detail.summary.storagePercentageUsed > 90
                          ? 'bg-red-500'
                          : detail.summary.storagePercentageUsed > 75
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${detail.summary.storagePercentageUsed}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-neutral-500 font-semibold mt-1">
                    {detail.summary.storagePercentageUsed}% of plan storage quota
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
            <div className="p-3 rounded-lg bg-[#050202] border border-[#2a1010]">
              <div className="font-black text-rose-300">{detail.summary.videosUploaded}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Videos</div>
            </div>
            <div className="p-3 rounded-lg bg-[#050202] border border-[#2a1010]">
              <div className="font-black text-sky-300">{detail.summary.imagesUploaded}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Images</div>
            </div>
            <div className="p-3 rounded-lg bg-[#050202] border border-[#2a1010]">
              <div className="font-black text-white">{detail.summary.totalFilesUploaded}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Total Uploads</div>
            </div>
          </div>
        </div>
      </div>

      {/* Posts, Scheduled, Failures & Uploads Tabs */}
      <div className="bg-[#0a0404] border border-[#2a1010] rounded-2xl overflow-hidden">
        {/* Sub-Tabs */}
        <div className="flex border-b border-[#2a1010] bg-[#050202] px-4">
          <button
            onClick={() => setActiveSection('recent')}
            className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeSection === 'recent'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Recent Posts ({detail.recentPosts.length})</span>
          </button>
          <button
            onClick={() => setActiveSection('scheduled')}
            className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeSection === 'scheduled'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled Posts ({detail.scheduledPosts.length})</span>
          </button>
          <button
            onClick={() => setActiveSection('failed')}
            className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeSection === 'failed'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Failed Jobs ({detail.failedJobs.length})</span>
          </button>
          <button
            onClick={() => setActiveSection('uploads')}
            className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeSection === 'uploads'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Upload History ({detail.uploadHistory.length})</span>
          </button>
        </div>

        {/* Tab Content: Recent Posts */}
        {activeSection === 'recent' && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2a1010] text-neutral-500 uppercase">
                    <th className="py-2.5 px-3">Post Caption</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Platforms</th>
                    <th className="py-2.5 px-3">Media</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a1010]/50">
                  {detail.recentPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-[#140606]">
                      <td className="py-3 px-3 max-w-[280px]">
                        {post.title && <div className="font-bold text-white truncate">{post.title}</div>}
                        <div className="text-neutral-400 truncate">{post.masterCaption}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            post.status === 'PUBLISHED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : post.status === 'SCHEDULED'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : post.status === 'FAILED'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {post.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {post.platformPosts.map((pp) => (
                            <span
                              key={pp.id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1b0d0d] border border-[#3b1717] text-neutral-300"
                            >
                              {pp.platform}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-neutral-400">
                        {post.mediaAsset ? (
                          <span className="font-mono">{post.mediaAsset.mimeType.split('/')[1]}</span>
                        ) : (
                          <span className="text-neutral-600">Text-only</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-neutral-500">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {detail.recentPosts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-neutral-500">
                        No posts created in this time window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Scheduled Posts */}
        {activeSection === 'scheduled' && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2a1010] text-neutral-500 uppercase">
                    <th className="py-2.5 px-3">Scheduled For</th>
                    <th className="py-2.5 px-3">Caption</th>
                    <th className="py-2.5 px-3">Target Platforms</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a1010]/50">
                  {detail.scheduledPosts.map((sp) => (
                    <tr key={sp.id} className="hover:bg-[#140606]">
                      <td className="py-3 px-3 text-blue-400 font-mono font-bold">
                        {sp.scheduledFor ? new Date(sp.scheduledFor).toLocaleString() : 'Not scheduled'}
                      </td>
                      <td className="py-3 px-3 max-w-[320px]">
                        {sp.title && <div className="font-bold text-white truncate">{sp.title}</div>}
                        <div className="text-neutral-400 truncate">{sp.masterCaption}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {sp.platformPosts.map((pp) => (
                            <span
                              key={pp.id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1b0d0d] border border-[#3b1717] text-neutral-300"
                            >
                              {pp.platform}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {sp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {detail.scheduledPosts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-neutral-500">
                        No upcoming scheduled posts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Failed Jobs */}
        {activeSection === 'failed' && (
          <div className="p-6">
            <div className="space-y-3">
              {detail.failedJobs.map((fj) => (
                <div
                  key={fj.id}
                  className="p-4 rounded-xl bg-[#080202] border border-red-500/20 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/25">
                      {fj.platform} FAILED
                    </span>
                    <span className="text-neutral-500">{new Date(fj.updatedAt).toLocaleString()}</span>
                  </div>
                  {fj.postTitle && <div className="font-bold text-white">{fj.postTitle}</div>}
                  <div className="text-neutral-400 truncate">{fj.caption}</div>
                  {fj.errorMessage && (
                    <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-900/40 text-red-300 font-mono text-[11px] mt-2">
                      Error: {fj.errorMessage}
                    </div>
                  )}
                </div>
              ))}
              {detail.failedJobs.length === 0 && (
                <p className="text-xs text-neutral-500 py-6 text-center">
                  No failed publishing jobs recorded for this user!
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Upload History */}
        {activeSection === 'uploads' && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2a1010] text-neutral-500 uppercase">
                    <th className="py-2.5 px-3">File</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">R2 Storage Status</th>
                    <th className="py-2.5 px-3">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a1010]/50">
                  {detail.uploadHistory.map((up) => (
                    <tr key={up.id} className="hover:bg-[#140606]">
                      <td className="py-3 px-3 font-bold text-white max-w-[220px] truncate" title={up.filename}>
                        {up.originalName || up.filename}
                      </td>
                      <td className="py-3 px-3 font-mono text-neutral-400">{up.mimeType}</td>
                      <td className="py-3 px-3 font-semibold text-neutral-200">{up.sizeFormatted}</td>
                      <td className="py-3 px-3">
                        {up.isArchived ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-neutral-800 text-neutral-400 border border-neutral-700">
                            CLEANED UP
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            ACTIVE IN R2
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-neutral-500">
                        {new Date(up.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {detail.uploadHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-neutral-500">
                        No uploaded files found in this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
