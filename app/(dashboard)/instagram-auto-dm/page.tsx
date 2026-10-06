"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Activity, Edit, Trash2, Power, PowerOff } from "lucide-react";

export default function InstagramAutoDmPage() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeRules: 0,
    totalRules: 0,
    totalSent: 0,
    totalFailed: 0,
  });

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
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
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
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
    if (!confirm("Are you sure you want to delete this automation?")) return;
    try {
      const res = await fetch(`/api/instagram-auto-dm/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAutomations();
      }
    } catch (error) {
      console.error("Failed to delete automation", error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Instagram Auto DM</h1>
          <p className="text-zinc-400 mt-1">Automate responses to comments on your Instagram posts.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/instagram-auto-dm/activity"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-lg transition-colors text-sm font-medium"
          >
            <Activity className="w-4 h-4" />
            Activity
          </Link>
          <Link
            href="/instagram-auto-dm/create"
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium shadow-[0_0_15px_rgba(220,38,38,0.3)]"
          >
            <Plus className="w-4 h-4" />
            Create Automation
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl">
          <p className="text-sm font-medium text-zinc-400">Active Automations</p>
          <p className="text-3xl font-bold text-white mt-2">{stats.activeRules}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl">
          <p className="text-sm font-medium text-zinc-400">Total Triggers</p>
          <p className="text-3xl font-bold text-white mt-2">{stats.totalRules}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl">
          <p className="text-sm font-medium text-zinc-400">DMs Sent</p>
          <p className="text-3xl font-bold text-white mt-2">{stats.totalSent}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl">
          <p className="text-sm font-medium text-zinc-400">Failed</p>
          <p className="text-3xl font-bold text-red-500 mt-2">{stats.totalFailed}</p>
        </div>
      </div>

      {/* Automations List */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-medium text-white">Your Rules</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">IG Account</th>
                <th className="px-6 py-3 font-medium">Media ID / Keyword</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-center">Metrics (T/S/F)</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    Loading automations...
                  </td>
                </tr>
              ) : automations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No automations found. Create your first rule to get started.
                  </td>
                </tr>
              ) : (
                automations.map((rule: any) => (
                  <tr key={rule.id} className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{rule.name}</td>
                    <td className="px-6 py-4 text-zinc-300">{rule.igAccount}</td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-300 truncate max-w-[200px]">{rule.mediaId || "All Posts"}</div>
                      <div className="text-xs text-zinc-500 mt-1">Key: "{rule.keyword}"</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${rule.enabled ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                        {rule.enabled ? "ACTIVE" : "PAUSED"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-zinc-400">
                      {rule.triggers || 0} / <span className="text-green-400">{rule.sent || 0}</span> / <span className="text-red-400">{rule.failed || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => toggleStatus(rule.id, rule.enabled)}
                          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                          title={rule.enabled ? "Disable" : "Enable"}
                        >
                          {rule.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => deleteAutomation(rule.id)}
                          className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
