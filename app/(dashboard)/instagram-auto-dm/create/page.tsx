"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Info, Image as ImageIcon, Video, Check } from "lucide-react";

export default function CreateInstagramAutoDmPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [useManualMedia, setUseManualMedia] = useState(false);
  
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

  useEffect(() => {
    if (!formData.socialAccountId) return;
    const fetchMedia = async () => {
      setLoadingMedia(true);
      setMediaError("");
      try {
        const res = await fetch(`/api/instagram-auto-dm/media?accountId=${formData.socialAccountId}`);
        if (res.ok) {
          const data = await res.json();
          setMediaList(data.media || []);
          if (data.media?.length === 0) {
            setMediaError("No recent posts or reels found. You may need to enter a Media ID manually.");
          }
        } else {
          setMediaError("Unable to fetch media automatically. Please enter Media ID manually.");
        }
      } catch (error) {
        setMediaError("Error fetching media.");
      } finally {
        setLoadingMedia(false);
      }
    };
    fetchMedia();
  }, [formData.socialAccountId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleMediaSelect = (id: string) => {
    setFormData(prev => ({ ...prev, mediaId: id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/instagram-auto-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, buttonLabel: formData.includeButton ? formData.buttonLabel : "", destinationUrl: formData.includeButton ? formData.destinationUrl : "" }),
      });
      
      if (res.ok) {
        router.push("/instagram-auto-dm?success=1");
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || "Failed to create automation"}`);
      }
    } catch (error) {
      console.error("Submit error", error);
      alert("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/instagram-auto-dm" className="p-2 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Create Automation</h1>
          <p className="text-zinc-400 mt-1">Configure your keyword trigger and automatic DM response.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold text-white mb-4">1. Select Account & Trigger</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Automation Name</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., AI Tool Link DM"
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Instagram Account</label>
              {accounts.length === 0 ? (
                <div className="p-4 bg-black border border-red-500/30 rounded-lg flex flex-col items-center justify-center gap-3">
                  <p className="text-sm text-zinc-400">No Instagram account connected.</p>
                  <Link href="/accounts" className="text-red-400 text-sm font-medium hover:underline">Connect Instagram</Link>
                </div>
              ) : (
                <select
                  name="socialAccountId"
                  required
                  value={formData.socialAccountId}
                  onChange={handleChange}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (@{acc.username})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-zinc-300">Select Instagram Post / Reel</label>
              <button 
                type="button" 
                onClick={() => setUseManualMedia(!useManualMedia)}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                {useManualMedia ? "Browse Recent Media" : "Enter Media ID Manually"}
              </button>
            </div>

            {useManualMedia ? (
              <div className="bg-black border border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-3">Advanced: Paste the exact Instagram Media ID.</p>
                <input
                  type="text"
                  name="mediaId"
                  required
                  value={formData.mediaId}
                  onChange={handleChange}
                  placeholder="e.g., 17981234567890"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {loadingMedia ? (
                  <div className="flex items-center justify-center p-8 bg-black border border-zinc-800 rounded-lg">
                    <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                    <span className="ml-3 text-sm text-zinc-400">Loading recent posts...</span>
                  </div>
                ) : mediaError ? (
                  <div className="p-4 bg-black border border-zinc-800 rounded-lg text-sm text-zinc-400">
                    {mediaError}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {mediaList.map((media) => {
                      const isSelected = formData.mediaId === media.id;
                      const imageUrl = media.thumbnail_url || media.media_url;
                      return (
                        <div
                          key={media.id}
                          onClick={() => handleMediaSelect(media.id)}
                          className={`relative cursor-pointer group rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-red-500' : 'border-zinc-800 hover:border-zinc-600'}`}
                        >
                          {imageUrl ? (
                            <img src={imageUrl} alt="Media" className="w-full h-32 object-cover" />
                          ) : (
                            <div className="w-full h-32 bg-zinc-900 flex items-center justify-center">
                              {media.media_type === 'VIDEO' ? <Video className="w-8 h-8 text-zinc-600" /> : <ImageIcon className="w-8 h-8 text-zinc-600" />}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                          
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}

                          <div className="absolute bottom-2 left-2 right-2 text-xs">
                            <div className="flex items-center gap-1.5 mb-1 text-zinc-300 font-medium">
                              {media.media_type === 'VIDEO' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                              {media.media_type === 'VIDEO' ? 'Reel / Video' : 'Post'}
                            </div>
                            <p className="text-white line-clamp-1 opacity-90">{media.caption || 'No caption'}</p>
                            <p className="text-zinc-400 mt-0.5">{new Date(media.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold text-white mb-4">2. Match Rule</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Comment Keyword</label>
              <input
                type="text"
                name="keyword"
                required
                value={formData.keyword}
                onChange={handleChange}
                placeholder="e.g., LINK"
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              />
              <p className="text-xs text-zinc-500 mt-2 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                When someone comments this keyword, the configured DM will be sent automatically. Matches are case-insensitive.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Match Type</label>
              <select
                name="matchType"
                value={formData.matchType}
                onChange={handleChange}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none"
              >
                <option value="EXACT">Exact Match</option>
                <option value="CONTAINS">Contains Keyword</option>
              </select>
              <p className="text-xs text-zinc-500 mt-2">
                {formData.matchType === 'EXACT' 
                  ? '"LINK" triggers only if the comment is exactly "LINK".'
                  : '"LINK" triggers even if comment is "Send LINK please".'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold text-white mb-4">3. Automatic DM</h2>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Message</label>
            <textarea
              name="message"
              required
              rows={4}
              value={formData.message}
              onChange={handleChange}
              placeholder="Thanks for commenting! Here is the link you requested 👇"
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-y"
            ></textarea>
            <p className="text-xs text-zinc-500 mt-2 text-right">{formData.message.length} characters</p>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="includeButton"
                checked={formData.includeButton}
                onChange={handleChange}
                className="w-5 h-5 rounded border-zinc-700 text-red-600 focus:ring-red-500 bg-black cursor-pointer"
              />
              <span className="text-sm font-medium text-white">Add Link Button</span>
            </label>

            {formData.includeButton && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-5 bg-black border border-zinc-800 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Button Text</label>
                  <input
                    type="text"
                    name="buttonLabel"
                    required={formData.includeButton}
                    value={formData.buttonLabel}
                    onChange={handleChange}
                    placeholder="e.g., Open Link"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Destination URL</label>
                  <input
                    type="url"
                    name="destinationUrl"
                    required={formData.includeButton}
                    value={formData.destinationUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Automation Status</h2>
          <label className="flex items-center justify-between cursor-pointer p-4 bg-black border border-zinc-800 rounded-lg hover:bg-zinc-900/80 transition-colors">
            <div>
              <span className="block text-sm font-bold text-white">Enable automation immediately</span>
              <span className="block text-xs text-zinc-400 mt-1">If enabled, this rule will start listening for comments instantly.</span>
            </div>
            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enabled ? 'bg-red-500' : 'bg-zinc-600'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            {/* Hidden actual checkbox to hold the value */}
            <input type="checkbox" name="enabled" checked={formData.enabled} onChange={handleChange} className="hidden" />
          </label>
        </div>

        <div className="flex items-center gap-4 justify-end">
          <Link href="/instagram-auto-dm" className="px-6 py-2.5 text-sm font-bold text-zinc-300 hover:text-white transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !formData.mediaId}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {loading ? "Saving..." : "Create Automation"}
          </button>
        </div>
      </form>
    </div>
  );
}
