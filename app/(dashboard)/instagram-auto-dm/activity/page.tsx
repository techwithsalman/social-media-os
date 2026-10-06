"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function InstagramAutoDmActivityPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

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
        return <AlertCircle className="w-4 h-4 text-zinc-400" />;
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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <Link 
            href="/instagram-auto-dm" 
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Automations
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">Execution Activity</h1>
          <p className="text-zinc-400 mt-1">Log of recent automation triggers and DMs sent.</p>
        </div>
        
        <button
          onClick={fetchActivities}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Automation / Account</th>
                <th className="px-6 py-4 font-medium">Commenter</th>
                <th className="px-6 py-4 font-medium">Comment Text</th>
                <th className="px-6 py-4 font-medium">Result</th>
                <th className="px-6 py-4 font-medium">Error Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && activities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-zinc-600" />
                      Loading activity logs...
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No activity found yet. Waiting for triggers...
                  </td>
                </tr>
              ) : (
                activities.map((log: any) => (
                  <tr key={log.id} className="border-b border-zinc-800 hover:bg-zinc-900/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-300">
                      {new Date(log.createdAt || log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{log.rule?.name || 'Unknown'}</div>
                      <div className="text-xs text-zinc-500 mt-1">{log.socialAccount?.name || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-300">
                      @{log.commenterId}
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-[250px] truncate text-zinc-300" title={log.commentText}>
                        {log.commentText}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadgeClass(log.result)}`}>
                        {getStatusIcon(log.result)}
                        {log.result}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-red-400 max-w-[200px] truncate" title={log.error}>
                      {log.error || "-"}
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
