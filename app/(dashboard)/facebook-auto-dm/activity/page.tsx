"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function FacebookAutoDmActivityPage() {
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    try {
      const res = await fetch("/api/facebook-auto-dm/activity");
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
      }
    } catch (err) {
      console.error("Failed to fetch activity", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link 
          href="/facebook-auto-dm"
          className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Log</h1>
          <p className="text-zinc-400 text-sm">Recent automated Facebook direct messages</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : executions.length === 0 ? (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center">
          <Clock className="w-12 h-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No activity yet</h2>
          <p className="text-zinc-400">When your automations trigger, they will appear here.</p>
        </div>
      ) : (
        <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <th className="px-6 py-4 font-semibold">Time</th>
                <th className="px-6 py-4 font-semibold">Rule</th>
                <th className="px-6 py-4 font-semibold">Triggered By</th>
                <th className="px-6 py-4 font-semibold">Comment</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {executions.map((exec) => (
                <tr key={exec.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-zinc-400 whitespace-nowrap">
                    {formatDistanceToNow(new Date(exec.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-white text-sm">{exec.rule?.name || 'Deleted Rule'}</div>
                    <div className="text-xs text-zinc-500">@{exec.socialAccount?.username || 'Unknown Page'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-zinc-300 font-medium">User {exec.commenterId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-zinc-400 max-w-xs truncate" title={exec.commentText}>
                      "{exec.commentText}"
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {exec.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-400 border border-red-500/20" title={exec.error}>
                        <XCircle className="w-3.5 h-3.5" />
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
