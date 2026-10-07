"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, MessageCircle } from "lucide-react";

export default function InstagramAutoDmActivityPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL"); // ALL, SENT, FAILED, SKIPPED

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/instagram-auto-dm/activity");
      if (res.ok) {
        const data = await res.json();
        setActivities(data.executions || []);
      }
    } catch (error) {
      console.error("Failed to fetch activities", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "SKIPPED":
        return <AlertCircle className="w-4 h-4 text-zinc-500" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "SENT":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "SKIPPED":
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
      case "FAILED":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  const filteredActivities = activities.filter(log => {
    if (filter === "ALL") return true;
    return log.status === filter;
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <Link href="/instagram-auto-dm" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Automations
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-red-500" />
            Execution Activity
          </h1>
          <p className="text-zinc-400 mt-1">Log of recent automation triggers and DMs sent.</p>
        </div>
      </div>

      <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {["ALL", "SENT", "FAILED", "SKIPPED"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                filter === f 
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
              }`}
            >
              {f === "ALL" ? "All Activity" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <th className="px-6 py-4 font-semibold">Time</th>
                <th className="px-6 py-4 font-semibold">Automation Name</th>
                <th className="px-6 py-4 font-semibold">Instagram User</th>
                <th className="px-6 py-4 font-semibold w-1/4">Comment & Match</th>
                <th className="px-6 py-4 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 bg-zinc-900/20">
                    No activity found for this filter.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((log: any) => (
                  <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                      {new Date(log.createdAt).toLocaleString(undefined, { 
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white text-sm">{log.rule?.name || 'Unknown Rule'}</div>
                      <div className="text-xs text-zinc-500 mt-1">Account: {log.socialAccount?.username || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-zinc-300 text-sm">@{log.commenterId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-zinc-300 line-clamp-2 italic mb-1">"{log.commentText}"</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Triggered on: <span className="text-zinc-300 font-mono bg-zinc-800 px-1 py-0.5 rounded">{log.rule?.keyword || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadgeClass(log.status)}`}>
                          {getStatusIcon(log.status)}
                          {log.status}
                        </span>
                      </div>
                      {log.error && log.status === "FAILED" && (
                        <div className="mt-2 text-xs text-red-400/80 max-w-[200px] truncate" title={log.error}>
                          {log.error}
                        </div>
                      )}
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
