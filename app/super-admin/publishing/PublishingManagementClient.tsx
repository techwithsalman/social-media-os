'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Youtube,
  Layers,
  ChevronRight,
  Info,
  Calendar,
  Lock,
  RotateCcw,
} from 'lucide-react';
import {
  ScheduledAuditReport,
  BulkCancelResult,
  APPROVED_YOUTUBE_CHANNELS,
} from '@/lib/super-admin-scheduled-cancel';

interface Props {
  initialAudit: ScheduledAuditReport;
}

export function PublishingManagementClient({ initialAudit }: Props) {
  const [audit, setAudit] = useState<ScheduledAuditReport>(initialAudit);
  const [activeTab, setActiveTab] = useState<'all' | 'candidates' | 'protected' | 'review'>('candidates');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDryRun, setIsDryRun] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionResult, setExecutionResult] = useState<BulkCancelResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshAudit = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/super-admin/publishing/bulk-cancel');
      if (!res.ok) {
        throw new Error('Failed to fetch scheduled posts audit');
      }
      const data = await res.json();
      setAudit(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error refreshing audit');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExecute = async () => {
    if (confirmInput.trim() !== 'CONFIRM_CANCEL') {
      setErrorMessage("Safety check: You must type 'CONFIRM_CANCEL' exactly.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/super-admin/publishing/bulk-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmToken: 'CONFIRM_CANCEL',
          dryRun: isDryRun,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute bulk cancellation');
      }

      setExecutionResult(data);
      setIsModalOpen(false);
      setConfirmInput('');

      // Refresh the audit to show updated states
      await refreshAudit();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing cancellation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = audit.items.filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchText =
        item.userEmail.toLowerCase().includes(q) ||
        item.workspaceName.toLowerCase().includes(q) ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.masterCaption && item.masterCaption.toLowerCase().includes(q));
      if (!matchText) return false;
    }

    if (activeTab === 'candidates') {
      return item.classification === 'CANCEL_CANDIDATE' || item.classification === 'PROTECTED_PARTIAL';
    }
    if (activeTab === 'protected') {
      return item.classification === 'PROTECTED_EXCLUSIVE' || item.classification === 'PROTECTED_PARTIAL';
    }
    if (activeTab === 'review') {
      return item.classification === 'MANUAL_REVIEW' || item.classification === 'IN_FLIGHT';
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
            <FileText className="w-4 h-4" />
            <span>Super Admin Operations</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mt-1">
            Publishing & Bulk Schedule Management
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
            Audit, protect, or bulk-cancel scheduled posts across the SaaS platform while strictly preserving the 4 approved YouTube channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshAudit}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#160a0a] hover:bg-[#251010] border border-[#3a1515] text-amber-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Audit'}</span>
          </button>

          <button
            onClick={() => {
              setExecutionResult(null);
              setErrorMessage(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-black transition-all shadow-lg shadow-red-950/40"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Bulk Cancel Non-Whitelisted</span>
          </button>
        </div>
      </div>

      {/* Section 1: Immutable Protected Channels Whitelist */}
      <div className="bg-[#0a0404] border border-[#2a1010] p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2a1010]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-black text-white">
                Protected YouTube Channel Whitelist (4 Channels)
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Scheduled videos connected to these four verified channels are permanently protected from automated cancellation.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            Immutable Whitelist Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {APPROVED_YOUTUBE_CHANNELS.map((ch, idx) => (
            <div
              key={ch.id}
              className="p-4 rounded-xl bg-[#050202] border border-emerald-500/20 relative overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <Youtube className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{ch.displayName}</div>
                  <div className="text-xs text-emerald-400 font-mono mt-0.5">{ch.handle}</div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#1a0808] flex items-center justify-between text-[11px] text-neutral-500">
                <span>Rule #{idx + 1}</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Protected
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Audit KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Total Scheduled</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-white mt-2">{audit.totalScheduledPosts}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Across all workspaces
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Protected YT Posts</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400 mt-2">
            {audit.counts.protectedExclusivePosts + audit.counts.protectedPartialPosts}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            {audit.counts.totalPreservedTargets} target(s) preserved
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">To Cancel</span>
            <Trash2 className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-black text-red-400 mt-2">
            {audit.counts.cancelCandidatePosts}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            {audit.counts.totalCancelledTargets} non-whitelisted target(s)
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Total Targets</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-white mt-2">{audit.totalPlatformTargets}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Multi-platform jobs
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">In-Flight Safe</span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-black text-blue-300 mt-2">{audit.counts.inFlightPosts}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Active / uploading safe
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a0404] border border-[#2a1010] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Manual Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-300 mt-2">{audit.counts.manualReviewPosts}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 font-semibold">
            Ambiguous posts protected
          </div>
        </div>
      </div>

      {/* Section 3: Platform Breakdown Pills */}
      <div className="bg-[#0a0404] border border-[#2a1010] p-5 rounded-2xl">
        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-3">
          Platform Distribution of Current Schedules
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(audit.platformBreakdown).map(([plat, counts]) => (
            <div
              key={plat}
              className="px-3 py-1.5 rounded-xl bg-[#050202] border border-[#2a1010] flex items-center gap-2 text-xs"
            >
              <span className="font-black text-white">{plat}:</span>
              <span className="text-neutral-300 font-bold">{counts.total} total</span>
              {counts.protected > 0 && (
                <span className="text-emerald-400 font-semibold">({counts.protected} protected)</span>
              )}
              {counts.toCancel > 0 && (
                <span className="text-red-400 font-semibold">({counts.toCancel} to cancel)</span>
              )}
            </div>
          ))}
          {Object.keys(audit.platformBreakdown).length === 0 && (
            <span className="text-xs text-neutral-600">No scheduled posts found in the system.</span>
          )}
        </div>
      </div>

      {/* Execution Results Banner if available */}
      {executionResult && (
        <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-sm text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>
                {executionResult.dryRun ? 'Dry Run Preview Completed' : 'Bulk Cancellation Executed Successfully!'}
              </span>
            </div>
            <span className="text-xs text-neutral-400">
              {new Date(executionResult.recoveryLog.timestamp).toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-2.5 rounded-lg bg-[#050202]/60 border border-emerald-500/20">
              <div className="text-neutral-400">Cancelled Posts:</div>
              <div className="text-base font-black text-white">{executionResult.cancelledPostsCount}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#050202]/60 border border-emerald-500/20">
              <div className="text-neutral-400">Cancelled Targets:</div>
              <div className="text-base font-black text-red-300">{executionResult.cancelledTargetsCount}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#050202]/60 border border-emerald-500/20">
              <div className="text-neutral-400">Preserved Protected:</div>
              <div className="text-base font-black text-emerald-300">
                {executionResult.preservedProtectedPostsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#050202]/60 border border-emerald-500/20">
              <div className="text-neutral-400">Audit Log ID:</div>
              <div className="text-[11px] font-mono text-neutral-300 truncate">
                {executionResult.recoveryLog.auditLogId || 'DryRun-NoLog'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Interactive Scheduled Posts Table */}
      <div className="space-y-4">
        {/* Controls: Search & Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0a0404] border border-[#2a1010] p-4 rounded-2xl">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by caption, user, workspace..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#050202] border border-[#2a1010] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('candidates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'candidates'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/35'
                  : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
              }`}
            >
              <span>Cancel Candidates ({audit.counts.cancelCandidatePosts + audit.counts.protectedPartialPosts})</span>
            </button>
            <button
              onClick={() => setActiveTab('protected')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'protected'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                  : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
              }`}
            >
              <span>Protected ({audit.counts.protectedExclusivePosts + audit.counts.protectedPartialPosts})</span>
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                  : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
              }`}
            >
              <span>All ({audit.totalScheduledPosts})</span>
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'review'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/35'
                  : 'bg-[#150707] text-neutral-400 hover:text-white border border-[#2a1010]'
              }`}
            >
              <span>Review / In-Flight ({audit.counts.manualReviewPosts + audit.counts.inFlightPosts})</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#0a0404] border border-[#2a1010] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#2a1010] bg-[#050202] text-neutral-400 uppercase">
                  <th className="py-3 px-4">Post & Caption</th>
                  <th className="py-3 px-4">Workspace & User</th>
                  <th className="py-3 px-4">Scheduled For</th>
                  <th className="py-3 px-4">Platform Targets</th>
                  <th className="py-3 px-4">Action Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a1010]/40">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#140606] transition-colors">
                    {/* Post */}
                    <td className="py-3.5 px-4 max-w-[280px]">
                      {item.title && <div className="font-bold text-white truncate">{item.title}</div>}
                      <div className="text-neutral-300 truncate font-medium">{item.masterCaption}</div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">ID: {item.id}</div>
                    </td>

                    {/* Workspace */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-white">{item.workspaceName}</div>
                      <div className="text-neutral-400">{item.userEmail}</div>
                    </td>

                    {/* Scheduled For */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-cyan-300 font-bold">
                        {item.scheduledFor ? new Date(item.scheduledFor).toLocaleDateString() : 'Unset'}
                      </div>
                      <div className="font-mono text-neutral-500">
                        {item.scheduledFor ? new Date(item.scheduledFor).toLocaleTimeString() : ''}
                      </div>
                    </td>

                    {/* Targets */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[320px]">
                        {item.targets.map((t) => (
                          <div
                            key={t.platformPostId}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                              t.isProtected
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-red-500/10 text-red-300 border-red-500/30'
                            }`}
                            title={t.matchedChannelName ? `Protected: ${t.matchedChannelName}` : `Target: ${t.accountName}`}
                          >
                            <span>{t.platform}</span>
                            {t.isProtected ? (
                              <Lock className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <span>({t.accountName || t.accountUsername})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Action Classification */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.classification === 'PROTECTED_EXCLUSIVE' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          100% PROTECTED
                        </span>
                      )}
                      {item.classification === 'PROTECTED_PARTIAL' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          PARTIAL: KEEP YT, CANCEL REST
                        </span>
                      )}
                      {item.classification === 'CANCEL_CANDIDATE' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/15 text-red-400 border border-red-500/30">
                          CANCEL CANDIDATE
                        </span>
                      )}
                      {item.classification === 'IN_FLIGHT' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          IN-FLIGHT SAFE
                        </span>
                      )}
                      {item.classification === 'MANUAL_REVIEW' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-neutral-800 text-neutral-300 border border-neutral-700">
                          MANUAL REVIEW
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-500 font-medium">
                      No scheduled posts matching this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation & Execution Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0e0404] border border-red-500/30 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h3 className="text-lg font-black text-white">Bulk Cancellation Safety Gate</h3>
            </div>

            <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-xs text-neutral-300 space-y-2">
              <p className="font-bold text-white">
                You are about to cancel all non-whitelisted scheduled posts across the entire platform.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                <li>
                  <strong className="text-emerald-400">Preserved:</strong> Schedules belonging to the 4 approved YouTube channels (@Tech With Salman, @Beyond History, @Sheru Bhai Official, @VEXORA).
                </li>
                <li>
                  <strong className="text-red-400">Cancelled:</strong> All other platforms (Facebook, Instagram, TikTok, LinkedIn, X, Pinterest) and other YouTube channels.
                </li>
                <li>
                  <strong className="text-blue-400">Safe:</strong> Published posts, draft posts, uploaded R2 media, and social accounts are NOT deleted.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-neutral-300">Dry Run (Preview Only):</label>
                <input
                  type="checkbox"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="rounded bg-[#1a0a0a] border-[#3a1515] text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1">
                  Type <span className="font-mono text-red-400 font-bold">CONFIRM_CANCEL</span> to proceed:
                </label>
                <input
                  type="text"
                  placeholder="CONFIRM_CANCEL"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#050202] border border-red-500/30 text-sm font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-xs text-red-300 font-medium">
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2a1010]">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setConfirmInput('');
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={isSubmitting || confirmInput.trim() !== 'CONFIRM_CANCEL'}
                className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black transition-all shadow-lg shadow-red-950"
              >
                {isSubmitting ? 'Executing...' : isDryRun ? 'Run Test Preview' : 'Execute Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
