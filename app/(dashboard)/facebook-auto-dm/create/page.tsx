"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";

export default function CreateFacebookAutoDmPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    socialAccountId: "",
    postId: "ANY",
    keyword: "",
    matchType: "EXACT",
    message: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        // Filter only FACEBOOK accounts
        const fbAccounts = data.accounts?.filter((acc: any) => acc.platform === "FACEBOOK") || [];
        setAccounts(fbAccounts);
        if (fbAccounts.length > 0) {
          setFormData((prev) => ({ ...prev, socialAccountId: fbAccounts[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch accounts", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/facebook-auto-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create automation");
      }

      router.push("/facebook-auto-dm?success=1");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      {/* Back to Dashboard Button */}
      <div className="mb-4 sm:mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Link 
          href="/facebook-auto-dm"
          className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Facebook Automation</h1>
          <p className="text-zinc-400 text-sm">Set up auto-replies for Facebook Page comments</p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-yellow-500 font-medium text-sm">Testing / Meta App Review Required</h3>
          <p className="text-yellow-500/80 text-xs mt-1">
            Private Replies for Facebook require &apos;pages_messaging&apos; and &apos;pages_read_engagement&apos; Advanced Access. Ensure your Meta App is configured and approved.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Automation Name</label>
          <input
            required
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Summer Sale Reply"
            className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Facebook Page</label>
          {accounts.length === 0 ? (
            <div className="bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-500 text-sm">
              No Facebook pages connected.
            </div>
          ) : (
            <select
              required
              value={formData.socialAccountId}
              onChange={(e) => setFormData({ ...formData, socialAccountId: e.target.value })}
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all appearance-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.username || acc.name || 'Unnamed Page'}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Post ID (Optional)</label>
            <input
              type="text"
              value={formData.postId}
              onChange={(e) => setFormData({ ...formData, postId: e.target.value })}
              placeholder="Leave as ANY for all posts"
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all font-mono text-sm"
            />
            <p className="text-[10px] text-zinc-500">Apply to a specific post ID or &quot;ANY&quot; for all posts.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Match Type</label>
            <select
              value={formData.matchType}
              onChange={(e) => setFormData({ ...formData, matchType: e.target.value })}
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all appearance-none"
            >
              <option value="EXACT">Exact Match</option>
              <option value="CONTAINS">Contains Keyword</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Trigger Keyword</label>
          <input
            required
            type="text"
            value={formData.keyword}
            onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
            placeholder="e.g., INFO"
            className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Private Reply Message</label>
          <textarea
            required
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Hi there! Here's the information you requested..."
            rows={5}
            className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all resize-none"
          />
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading || accounts.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-bold shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Automation
          </button>
        </div>
      </form>
    </div>
  );
}
