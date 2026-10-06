"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Info } from "lucide-react";

export default function CreateInstagramAutoDmPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  
  const [formData, setFormData] = useState({
    name: "",
    socialAccountId: "",
    mediaId: "",
    keyword: "",
    matchType: "EXACT",
    message: "",
    includeButton: false,
    buttonLabel: "",
    destinationUrl: "",
    enabled: true,
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch("/api/accounts?platform=INSTAGRAM");
        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts || []);
          if (data.accounts?.length > 0) {
            setFormData(prev => ({ ...prev, socialAccountId: data.accounts[0].id }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch accounts", error);
      }
    };
    fetchAccounts();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/instagram-auto-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        router.push("/instagram-auto-dm");
      } else {
        const error = await res.json();
        alert(`Error: ${error.message || "Failed to create automation"}`);
      }
    } catch (error) {
      console.error("Submit error", error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <Link 
          href="/instagram-auto-dm" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Automations
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create Automation</h1>
        <p className="text-zinc-400 mt-1">Set up a new Instagram DM auto-responder rule.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-xl shadow-lg">
        
        {/* Basic Settings */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-zinc-800 pb-2 text-red-500">Basic Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Automation Name</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Lead Magnet Giveaway"
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Instagram Account</label>
              <select
                name="socialAccountId"
                required
                value={formData.socialAccountId}
                onChange={handleChange}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none"
              >
                <option value="" disabled>Select Account</option>
                {accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>{acc.username || acc.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Trigger Settings */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-semibold border-b border-zinc-800 pb-2 text-red-500">Trigger Conditions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                Trigger Content (Media ID)
                <span title="Leave empty to apply to all posts" className="text-zinc-500 cursor-help"><Info className="w-4 h-4"/></span>
              </label>
              <input
                type="text"
                name="mediaId"
                value={formData.mediaId}
                onChange={handleChange}
                placeholder="Optional: specific post ID"
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Trigger Keyword</label>
              <input
                type="text"
                name="keyword"
                required
                value={formData.keyword}
                onChange={handleChange}
                placeholder="e.g. SEND, GUIDE, INFO"
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Match Type</label>
              <select
                name="matchType"
                value={formData.matchType}
                onChange={handleChange}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none"
              >
                <option value="EXACT">Exact Match</option>
                <option value="CONTAINS">Contains Phrase</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Settings */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-semibold border-b border-zinc-800 pb-2 text-red-500">DM Response</h2>
          
          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium text-zinc-300">Message Content</label>
            <textarea
              name="message"
              required
              rows={4}
              value={formData.message}
              onChange={handleChange}
              placeholder="Hi there! Thanks for commenting. Here is the link you requested..."
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-y"
            />
          </div>

          <div className="space-y-4 pt-2 border border-zinc-800/50 p-4 rounded-lg bg-black/30">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="includeButton"
                checked={formData.includeButton}
                onChange={handleChange}
                className="w-5 h-5 rounded border-zinc-700 text-red-600 focus:ring-red-500 focus:ring-offset-black bg-black"
              />
              <span className="text-sm font-medium text-zinc-300">Add action button (Ice Breaker / Link)</span>
            </label>

            {formData.includeButton && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pl-8">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Button Label</label>
                  <input
                    type="text"
                    name="buttonLabel"
                    required={formData.includeButton}
                    value={formData.buttonLabel}
                    onChange={handleChange}
                    placeholder="e.g. Get Started"
                    className="w-full bg-black border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Destination URL</label>
                  <input
                    type="url"
                    name="destinationUrl"
                    required={formData.includeButton}
                    value={formData.destinationUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full bg-black border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-zinc-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="enabled"
              checked={formData.enabled}
              onChange={handleChange}
              className="w-5 h-5 rounded border-zinc-700 text-red-600 focus:ring-red-500 focus:ring-offset-black bg-black"
            />
            <span className="text-sm font-medium text-white">Enable immediately</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Automation
          </button>
        </div>
      </form>
    </div>
  );
}
