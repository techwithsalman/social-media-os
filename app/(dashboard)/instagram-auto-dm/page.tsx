"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Activity, Edit, Trash2, Power, PowerOff, MessageCircle, AlertCircle, BarChart3, Settings2 } from "lucide-react";

import { Suspense } from "react";

function InstagramAutoDmContent() {
  const searchParams = useSearchParams();
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [stats, setStats] = useState({
    activeRules: 0,
    totalRules: 0,
    totalSent: 0,
    totalFailed: 0,
  });

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setSuccessMsg("Automation created successfully.");
      setTimeout(() => setSuccessMsg(""), 5000);
    } else if (searchParams.get("success") === "enabled") {
      setSuccessMsg("Auto DM Enabled");
      setTimeout(() => setSuccessMsg(""), 5000);
    }
    fetchAutomations();
    
    // Add lightweight client-side polling every 5s
    const interval = setInterval(() => {
      fetchAutomations(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [searchParams]);

  const fetchAutomations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/instagram-auto-dm");
      if (res.ok) {
        const data = await res.json();
        setAutomations(data.rules || []);
        setStats(data.stats || { activeRules: 0, totalRules: 0, totalSent: 0, totalFailed: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch automations", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const res = await fetch(`/api/instagram-auto-dm/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newStatus }),
      });
      if (res.ok) {
        fetchAutomations();
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automation? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/instagram-auto-dm/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAutomations();
      }
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Back to Dashboard Button */}
      <div className="mb-4 sm:mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Back to Dashboard
        </Link>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm font-medium">
          {successMsg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Instagram Auto DM
          </h1>
          <p className="text-zinc-400 mt-1">Automatically send a private Instagram message when someone comments a matching keyword on your selected content.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link 
            href="/instagram-auto-dm/activity"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all"
          >
            <Activity className="w-4 h-4" />
            Activity
          </Link>
          <Link 
            href="/instagram-auto-dm/create"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-red-900/20 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Automation
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-zinc-400">Active Automations</p>
                <Settings2 className="w-4 h-4 text-zinc-500" />
              </div>
              <p className="text-3xl font-bold text-white relative z-10">{stats.activeRules}</p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-zinc-400">Total Triggers</p>
                <BarChart3 className="w-4 h-4 text-zinc-500" />
              </div>
              <p className="text-3xl font-bold text-white relative z-10">{stats.totalRules}</p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-zinc-400">DMs Sent</p>
                <MessageCircle className="w-4 h-4 text-green-500/70" />
              </div>
              <p className="text-3xl font-bold text-white relative z-10">{stats.totalSent}</p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-zinc-400">Failed</p>
                <AlertCircle className="w-4 h-4 text-red-500/70" />
              </div>
              <p className="text-3xl font-bold text-white relative z-10">{stats.totalFailed}</p>
            </div>
          </div>

          {automations.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
                <MessageCircle className="w-8 h-8 text-zinc-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No Auto DM automations yet</h2>
              <p className="text-zinc-400 max-w-sm mb-6">Create your first rule to automatically send Instagram DMs when people comment a keyword.</p>
              <Link 
                href="/instagram-auto-dm/create"
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all"
              >
                Create Automation
              </Link>
            </div>
          ) : (
            <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                    <th className="px-6 py-4 font-semibold">Automation Name</th>
                    <th className="px-6 py-4 font-semibold">Match Rule</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Triggers</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {automations.map((rule) => (
                    <tr key={rule.id} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm mb-1">{rule.name}</div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1">
                          <span>@{rule.socialAccount?.username || "Unknown"}</span>
                          <span className="text-zinc-600">•</span>
                          <span title={rule.mediaId}>Post ID: {rule.mediaId.length > 8 ? rule.mediaId.slice(0,8)+'...' : rule.mediaId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">
                              {rule.matchType === 'ANY_COMMENT' ? 'ANY' : rule.keyword}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            {rule.matchType === 'ANY_COMMENT' ? 'Any Comment' : rule.matchType === 'EXACT' ? 'Exact Match' : 'Contains Keyword'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full border ${rule.enabled ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-zinc-900 text-zinc-500 border-zinc-800"}`}>
                          {rule.enabled ? "ACTIVE" : "PAUSED"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-white">{rule._count?.executions || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => toggleStatus(rule.id, rule.enabled)}
                            className={`p-2 rounded-lg transition-colors ${rule.enabled ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-green-400 hover:bg-green-500/10'}`}
                            title={rule.enabled ? "Disable Automation" : "Enable Automation"}
                          >
                            {rule.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <Link
                            href="/instagram-auto-dm/activity"
                            className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="View Activity"
                          >
                            <Activity className="w-4 h-4" />
                          </Link>
                          <button 
                            onClick={() => deleteAutomation(rule.id)}
                            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}


export default function InstagramAutoDmPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading...</div>}>
      <InstagramAutoDmContent />
    </Suspense>
  );
}


