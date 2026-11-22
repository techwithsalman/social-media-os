'use client';

import React, { useState } from 'react';
import {
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Info,
  Search,
  FileText,
  Database,
  Lock,
  Clock,
  Layers,
  FolderArchive,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  R2AuditReport,
  R2AuditItem,
  R2CleanupExecutionResult,
  R2CleanupLogItem,
  R2ObjectClassification,
} from '@/lib/storage/r2-audit-types';

interface Props {
  initialAudit: R2AuditReport;
  initialHistory: R2CleanupLogItem[];
}

export function StorageManagementClient({ initialAudit, initialHistory }: Props) {
  const [audit, setAudit] = useState<R2AuditReport>(initialAudit);
  const [history, setHistory] = useState<R2CleanupLogItem[]>(initialHistory);
  const [activeTab, setActiveTab] = useState<'eligible' | 'preserved' | 'workspaces' | 'history'>('eligible');
  const [search, setSearch] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<string>('all');

  // Operation state
  const [isAuditing, setIsAuditing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<R2CleanupExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal confirmation state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDryRun, setIsDryRun] = useState(false);
  const [safetyConsent, setSafetyConsent] = useState(false);

  // Refresh live audit
  const refreshAudit = async () => {
    setIsAuditing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/super-admin/storage/audit');
      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          !res.ok
            ? `Server error (HTTP ${res.status}): ${res.statusText || 'Gateway error'}. ${text.slice(0, 150)}`
            : `Unexpected non-JSON response from server: ${text.slice(0, 150)}`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to refresh storage audit (HTTP ${res.status})`);
      }

      setAudit(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error refreshing storage audit');
    } finally {
      setIsAuditing(false);
    }
  };

  // Refresh cleanup history
  const refreshHistory = async () => {
    try {
      const res = await fetch('/api/super-admin/storage/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // non-blocking
    }
  };

  // Trigger modal for Dry Run
  const handleOpenDryRun = () => {
    setIsDryRun(true);
    setConfirmInput('CONFIRM_CLEANUP');
    setSafetyConsent(true);
    setIsModalOpen(true);
  };

  // Trigger modal for Live Permanent Cleanup
  const handleOpenLiveCleanup = () => {
    setIsDryRun(false);
    setConfirmInput('');
    setSafetyConsent(false);
    setIsModalOpen(true);
  };

  // Execute Cleanup (Dry Run or Live)
  const handleExecuteCleanup = async () => {
    if (confirmInput.trim() !== 'CONFIRM_CLEANUP') {
      setErrorMessage("Safety check: You must type 'CONFIRM_CLEANUP' exactly.");
      return;
    }

    if (!isDryRun && !safetyConsent) {
      setErrorMessage('Safety check: You must check the confirmation checkbox.');
      return;
    }

    setIsExecuting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/super-admin/storage/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmToken: 'CONFIRM_CLEANUP',
          dryRun: isDryRun,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          !res.ok
            ? `Server execution error (HTTP ${res.status}): ${res.statusText || 'Gateway timeout'}. ${text.slice(0, 150)}`
            : `Unexpected non-JSON response from server: ${text.slice(0, 150)}`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to execute R2 cleanup (HTTP ${res.status})`);
      }

      setExecutionResult(data);
      setIsModalOpen(false);
      setConfirmInput('');
      setSafetyConsent(false);

      // Refresh audit and history after action
      await Promise.all([refreshAudit(), refreshHistory()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing cleanup');
    } finally {
      setIsExecuting(false);
    }
  };

  // Filtered files
  const filteredEligible = audit.eligibleItems.filter((item) => {
    if (selectedClassification !== 'all' && item.classification !== selectedClassification) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.key.toLowerCase().includes(q) ||
        (item.workspaceName && item.workspaceName.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredPreserved = audit.retainedSample.filter((item) => {
    if (selectedClassification !== 'all' && item.classification !== selectedClassification) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.key.toLowerCase().includes(q) ||
        (item.workspaceName && item.workspaceName.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q)) ||
        (item.protectedChannel && item.protectedChannel.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-400">
            <HardDrive className="w-4 h-4" />
            <span>Cloudflare R2 Storage Management</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mt-1">
            R2 Storage Audit & Safe Cleanup
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-3xl">
            Audit objects in bucket <code className="text-teal-300 font-mono text-xs px-1.5 py-0.5 rounded bg-teal-950/60 border border-teal-800/60">{audit.bucketName}</code>, reconcile against live database references, strictly protect immutable content (4 approved YouTube channels, published posts, active schedules), and safely purge confirmed orphaned or cancelled files.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={refreshAudit}
            disabled={isAuditing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] border border-neutral-800 text-neutral-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin text-teal-400' : ''}`} />
            <span>Audit Storage</span>
          </button>

          <button
            onClick={handleOpenDryRun}
            disabled={audit.eligibleCount === 0 || isAuditing || isExecuting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Dry Run Cleanup</span>
          </button>

          <button
            onClick={handleOpenLiveCleanup}
            disabled={audit.eligibleCount === 0 || isAuditing || isExecuting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-950/40 transition-all disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Execute Safe Cleanup</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 flex items-start gap-3 text-sm">
          <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Operation Notice</p>
            <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Configuration Notice (if R2 credentials absent in local environment) */}
      {audit.configurationNotice && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-700/60 text-amber-200 flex items-start gap-3 text-sm">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">R2 Storage Environment Notice</p>
            <p className="text-xs text-amber-300/90 mt-0.5">{audit.configurationNotice}</p>
          </div>
        </div>
      )}

      {/* Execution Result Banner */}
      {executionResult && (
        <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-600/60 text-emerald-100 flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-base">
                {executionResult.dryRun ? 'Dry Run Simulation Completed' : 'Safe Cleanup Successfully Executed'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {executionResult.dryRun ? 'SIMULATION' : 'LIVE DELETION'}
              </span>
            </div>
            <p className="text-xs text-emerald-200/90">
              {executionResult.dryRun
                ? `Simulated cleanup of ${executionResult.deletedCount} eligible object(s). Potential storage to free: ${executionResult.freedMB} MB (${executionResult.freedGB} GB).`
                : `Permanently deleted ${executionResult.deletedCount} verified unnecessary object(s). Freed ${executionResult.freedMB} MB (${executionResult.freedGB} GB) from Cloudflare R2 bucket.`}
            </p>
            {executionResult.auditLogId && (
              <p className="text-[11px] text-emerald-300/80 font-mono mt-1">
                ActivityLog Reference ID: {executionResult.auditLogId}
              </p>
            )}
          </div>
          <button
            onClick={() => setExecutionResult(null)}
            className="text-xs text-emerald-400 hover:text-white font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Storage Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total R2 Bucket Objects & Storage */}
        <div className="p-5 rounded-2xl bg-[#090e17] border border-neutral-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase tracking-wider">
            <span>Total R2 Objects</span>
            <HardDrive className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{audit.totalBucketObjects.toLocaleString()}</span>
            <span className="text-xs text-neutral-400 font-bold">files</span>
          </div>
          <div className="text-xs text-neutral-400 pt-1 border-t border-neutral-800/60 flex items-center justify-between">
            <span>Bucket Capacity</span>
            <span className="font-mono text-teal-300 font-bold">{audit.totalBucketGB} GB</span>
          </div>
        </div>

        {/* Confirmed Eligible For Deletion */}
        <div className="p-5 rounded-2xl bg-[#140b0b] border border-rose-900/40 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-rose-300 text-xs font-bold uppercase tracking-wider">
            <span>Eligible for Deletion</span>
            <Trash2 className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-200">{audit.eligibleCount.toLocaleString()}</span>
            <span className="text-xs text-rose-300 font-bold">files</span>
          </div>
          <div className="text-xs text-rose-300/80 pt-1 border-t border-rose-900/30 flex items-center justify-between">
            <span>Recoverable Space</span>
            <span className="font-mono text-rose-400 font-black">{audit.eligibleGB} GB ({audit.eligibleMB} MB)</span>
          </div>
        </div>

        {/* Safely Retained Objects */}
        <div className="p-5 rounded-2xl bg-[#06120b] border border-emerald-900/40 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <span>Safely Retained</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-200">{audit.retainedCount.toLocaleString()}</span>
            <span className="text-xs text-emerald-300 font-bold">files</span>
          </div>
          <div className="text-xs text-emerald-300/80 pt-1 border-t border-emerald-900/30 flex items-center justify-between">
            <span>Preserved Storage</span>
            <span className="font-mono text-emerald-400 font-black">{audit.retainedGB} GB</span>
          </div>
        </div>

        {/* Protected YouTube Whitelist Shield */}
        <div className="p-5 rounded-2xl bg-[#120e06] border border-amber-800/40 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-amber-300 text-xs font-bold uppercase tracking-wider">
            <span>Protected Channels</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-amber-200">4</span>
            <span className="text-xs text-amber-400 font-bold">YouTube Channels</span>
          </div>
          <div className="text-[11px] text-amber-300/80 pt-1 border-t border-amber-900/30 truncate">
            @Tech With Salman, @Beyond History, @Sheru Bhai, @VEXORA
          </div>
        </div>
      </div>

      {/* Category Classification Breakdown */}
      <div className="p-6 rounded-2xl bg-[#090e17] border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            <h2 className="text-base font-black text-white tracking-tight">R2 Object Classifications</h2>
          </div>
          <span className="text-xs text-neutral-400">Reconciled against live production database</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.values(audit.categories).map((cat) => {
            const isEligibleCat = !cat.isProtected;
            return (
              <button
                key={cat.classification}
                onClick={() => {
                  setSelectedClassification(
                    selectedClassification === cat.classification ? 'all' : cat.classification
                  );
                }}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  selectedClassification === cat.classification
                    ? isEligibleCat
                      ? 'bg-rose-950/60 border-rose-600 shadow-md ring-1 ring-rose-500'
                      : 'bg-emerald-950/60 border-emerald-600 shadow-md ring-1 ring-emerald-500'
                    : isEligibleCat
                    ? 'bg-[#120808] border-rose-900/40 hover:border-rose-700/60'
                    : 'bg-[#060e12] border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isEligibleCat
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isEligibleCat ? 'ELIGIBLE' : 'IMMUTABLE'}
                  </span>
                  <span className="text-xs font-mono font-bold text-neutral-400">{cat.sizeFormatted}</span>
                </div>
                <p className="text-xs font-black text-white mt-2 truncate">{cat.label}</p>
                <p className="text-lg font-black text-neutral-200 mt-0.5">{cat.count.toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tabs and Content Area */}
      <div className="space-y-4">
        {/* Navigation Tabs and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab('eligible');
                setSelectedClassification('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'eligible'
                  ? 'bg-rose-500/15 text-rose-200 border border-rose-500/30 shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Eligible for Deletion ({audit.eligibleCount})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('preserved');
                setSelectedClassification('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'preserved'
                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Safely Preserved Sample ({audit.retainedSample.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('workspaces');
                setSelectedClassification('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'workspaces'
                  ? 'bg-teal-500/15 text-teal-200 border border-teal-500/30 shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span>Workspace Breakdown ({audit.workspaces.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                setSelectedClassification('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Audit History ({history.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search file key, workspace, reason..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0d131f] border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-teal-500/60"
            />
          </div>
        </div>

        {/* Tab 1: Eligible Files for Safe Deletion */}
        {activeTab === 'eligible' && (
          <div className="space-y-3">
            {filteredEligible.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[#090e17] border border-neutral-800 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-black text-white">No Unnecessary Files Eligible for Cleanup</p>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Every file in Cloudflare R2 is either actively used, belongs to approved YouTube channels, published, scheduled, or within the 24-hour upload grace period.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-800 bg-[#090e17] overflow-hidden shadow-xl">
                <div className="p-4 border-b border-neutral-800/80 bg-[#0b121e] flex items-center justify-between text-xs text-neutral-400 font-bold">
                  <span>Showing {filteredEligible.length} of {audit.eligibleCount} eligible files</span>
                  <span className="font-mono text-rose-300">Total: {audit.eligibleGB} GB ({audit.eligibleMB} MB)</span>
                </div>

                <div className="divide-y divide-neutral-800/60 overflow-x-auto">
                  {filteredEligible.map((item) => (
                    <div key={item.key} className="p-4 hover:bg-[#0f172a]/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            {item.classification === 'CANCELLED_POST_ONLY' ? 'CANCELLED POST MEDIA' : 'ORPHANED UPLOAD'}
                          </span>
                          <span className="font-mono text-neutral-300 font-bold break-all">{item.key}</span>
                        </div>
                        <p className="text-neutral-400 text-[11px]">{item.reason}</p>
                        {item.associatedPostTitles.length > 0 && (
                          <p className="text-neutral-500 text-[11px]">
                            Associated Post: <span className="text-neutral-300">{item.associatedPostTitles.join(', ')}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <p className="font-mono font-black text-white text-sm">{item.sizeFormatted}</p>
                          <p className="text-[10px] text-neutral-500">{item.workspaceName || 'Unassigned'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Safely Preserved Files Sample */}
        {activeTab === 'preserved' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-neutral-800 bg-[#090e17] overflow-hidden shadow-xl">
              <div className="p-4 border-b border-neutral-800/80 bg-[#0b121e] flex items-center justify-between text-xs text-neutral-400 font-bold">
                <span>Showing {filteredPreserved.length} sample preserved files (Total retained: {audit.retainedCount})</span>
                <span className="font-mono text-emerald-300">Total Preserved: {audit.retainedGB} GB</span>
              </div>

              <div className="divide-y divide-neutral-800/60 overflow-x-auto">
                {filteredPreserved.map((item) => (
                  <div key={item.key} className="p-4 hover:bg-[#0f172a]/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {item.classification}
                        </span>
                        {item.protectedChannel && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            🛡️ {item.protectedChannel}
                          </span>
                        )}
                        <span className="font-mono text-neutral-300 font-bold break-all">{item.key}</span>
                      </div>
                      <p className="text-neutral-400 text-[11px]">{item.reason}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <p className="font-mono font-black text-white text-sm">{item.sizeFormatted}</p>
                        <p className="text-[10px] text-neutral-500">{item.workspaceName || 'Unassigned'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Workspace Storage Breakdown */}
        {activeTab === 'workspaces' && (
          <div className="rounded-2xl border border-neutral-800 bg-[#090e17] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-neutral-800/80 bg-[#0b121e] text-xs text-neutral-400 font-bold">
              Storage and Object Distribution by Workspace
            </div>
            <div className="divide-y divide-neutral-800/60">
              {audit.workspaces.map((ws) => (
                <div key={ws.workspaceId} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-black text-white text-sm">{ws.workspaceName}</p>
                    <p className="text-[11px] text-neutral-500 font-mono mt-0.5">ID: {ws.workspaceId}</p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase">Total Objects</p>
                      <p className="font-mono text-neutral-200 font-bold">{ws.totalObjects} ({ws.totalFormatted})</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-rose-400 uppercase">Eligible</p>
                      <p className="font-mono text-rose-300 font-bold">{ws.eligibleObjects} ({ws.eligibleFormatted})</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-400 uppercase">Preserved</p>
                      <p className="font-mono text-emerald-300 font-bold">{ws.retainedObjects} ({ws.retainedFormatted})</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Audit & Cleanup History */}
        {activeTab === 'history' && (
          <div className="rounded-2xl border border-neutral-800 bg-[#090e17] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-neutral-800/80 bg-[#0b121e] text-xs text-neutral-400 font-bold">
              Audit Logs & Cleanup Activity History
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">No storage cleanup actions logged yet.</div>
            ) : (
              <div className="divide-y divide-neutral-800/60">
                {history.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          {log.action}
                        </span>
                        <span className="text-neutral-400 text-[11px]">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-neutral-200 font-medium">{log.details}</p>
                    </div>
                    <div className="text-right text-[11px] text-neutral-500 font-mono">
                      Actor: {log.actorUserId || 'super_admin'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0b101b] border border-neutral-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDryRun ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {isDryRun ? <Play className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {isDryRun ? 'Confirm Dry Run Simulation' : 'Confirm Permanent R2 Cleanup'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {isDryRun ? 'Simulates cleanup without modifying or deleting files.' : 'Permanently deletes confirmed orphaned and cancelled files.'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white text-xs font-bold">
                ✕
              </button>
            </div>

            {/* Summary Box */}
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${isDryRun ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-rose-950/20 border-rose-800/40 text-rose-200'}`}>
              <div className="flex items-center justify-between font-bold">
                <span>Target Cloudflare R2 Bucket:</span>
                <span className="font-mono text-white">{audit.bucketName}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>Objects to be deleted:</span>
                <span className="font-mono text-white">{audit.eligibleCount} files</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>Estimated Storage Freed:</span>
                <span className="font-mono text-white">{audit.eligibleGB} GB ({audit.eligibleMB} MB)</span>
              </div>
              <div className="flex items-center justify-between font-bold pt-2 border-t border-neutral-800/60">
                <span>Immutable Protected Channels:</span>
                <span className="text-emerald-400">4 YouTube Channels (100% Preserved)</span>
              </div>
            </div>

            {/* Safety Confirmation Checkbox (for live cleanup) */}
            {!isDryRun && (
              <div className="space-y-4">
                <label className="flex items-start gap-3 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={safetyConsent}
                    onChange={(e) => setSafetyConsent(e.target.checked)}
                    className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-rose-600 focus:ring-0"
                  />
                  <span>
                    I confirm that I have reviewed the eligible files list. I authorize the permanent deletion of these {audit.eligibleCount} verified orphaned and cancelled-post objects from Cloudflare R2.
                  </span>
                </label>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-300">
                    Type <code className="text-rose-400 font-mono font-black">CONFIRM_CLEANUP</code> to proceed:
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="CONFIRM_CLEANUP"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#060a12] border border-neutral-800 text-sm font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isExecuting}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCleanup}
                disabled={
                  isExecuting ||
                  confirmInput.trim() !== 'CONFIRM_CLEANUP' ||
                  (!isDryRun && !safetyConsent)
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  isDryRun
                    ? 'bg-amber-500 hover:bg-amber-400 text-black'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isExecuting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDryRun ? 'Run Simulation' : 'Permanently Delete Files'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
