"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Info, Instagram, Video, Image as ImageIcon, MessageCircle, X, ExternalLink } from "lucide-react";

function formatDate(isoStr: string) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CreateInstagramAutoDmPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [useManualMedia, setUseManualMedia] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    socialAccountId: "",
    mediaId: "", // Optional now, defaults to ANY
    keyword: "",
    matchType: "EXACT",
    message: "",
    includeButton: false,
    buttonLabel: "",
    destinationUrl: "",
    enabled: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch("/api/accounts?platform=INSTAGRAM");
        if (res.ok) {
          const data = await res.json();
          const allAccounts = data.accounts || [];
          const igAccounts = allAccounts.filter((acc: any) => acc.platform === 'INSTAGRAM');
          setAccounts(igAccounts);
          if (igAccounts.length > 0) {
            setFormData(prev => ({ ...prev, socialAccountId: igAccounts[0].id }));
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
        } else {
          setMediaError("Unable to fetch media automatically. Please check your token or use manual entry.");
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
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleMediaSelect = (id: string) => {
    setFormData(prev => ({ ...prev, mediaId: prev.mediaId === id ? "" : id }));
    setIsModalOpen(false);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Automation Name is required.";
    if (!formData.socialAccountId) newErrors.socialAccountId = "Please select an Instagram account.";
    if (formData.matchType !== 'ANY_COMMENT' && !formData.keyword.trim()) newErrors.keyword = "Trigger Keyword is required.";
    if (!formData.message.trim()) newErrors.message = "Message Content is required.";
    
    if (formData.includeButton) {
      if (!formData.buttonLabel.trim()) newErrors.buttonLabel = "Button Label is required.";
      if (!formData.destinationUrl.trim()) {
        newErrors.destinationUrl = "Destination URL is required.";
      } else if (!/^https?:\/\/.+/.test(formData.destinationUrl)) {
        newErrors.destinationUrl = "Please enter a valid URL (http/https).";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);

    const payload = { ...formData };
      if (payload.matchType === 'ANY_COMMENT') {
        payload.keyword = 'ANY';
      }
    if (!payload.includeButton) {
      payload.buttonLabel = "";
      payload.destinationUrl = "";
    }

    try {
      const res = await fetch("/api/instagram-auto-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        router.push("/instagram-auto-dm?success=1");
      } else {
        const error = await res.json();
        alert(error.error || "Unable to save automation. Please try again.");
      }
    } catch (error) {
      console.error("Submit error", error);
      alert("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === formData.socialAccountId);
  const selectedMedia = mediaList.find(m => m.id === formData.mediaId);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/instagram-auto-dm" 
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Back to Automations"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                <h1 className="text-lg font-bold text-white leading-none">Create Automation</h1>
              </div>
              <p className="text-xs text-zinc-400 mt-1 hidden sm:block">Set up an Instagram comment-to-DM automation.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/instagram-auto-dm" 
              className="hidden sm:block px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? "Saving..." : "Save Automation"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Form Left Column */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Section 1: Basic Settings */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[16px] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/50 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center">
                  <span className="text-xs font-bold text-zinc-400">1</span>
                </div>
                <h2 className="text-base font-semibold text-white">Basic Settings</h2>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Automation Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Free Guide Request"
                    className={`w-full bg-black border ${errors.name ? 'border-red-500' : 'border-zinc-800'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all`}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1.5">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Instagram Account</label>
                  
                  {accounts.length === 0 ? (
                    <div className="p-4 bg-black border border-zinc-800 rounded-lg flex flex-col items-center justify-center gap-3">
                      <p className="text-sm text-zinc-400">No Instagram account connected.</p>
                      <Link href="/accounts" className="text-red-400 text-sm font-medium hover:underline">Connect Instagram</Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {accounts.map(acc => (
                        <React.Fragment key={acc.id}>
                          <div 
                            onClick={() => setFormData(prev => ({ ...prev, socialAccountId: acc.id }))}
                            className={`relative cursor-pointer p-3 rounded-lg border flex items-center gap-3 transition-all ${formData.socialAccountId === acc.id ? 'bg-red-500/5 border-red-500 shadow-sm shadow-red-500/10' : 'bg-black border-zinc-800 hover:border-zinc-700'}`}
                          >
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                              {acc.profileImageUrl ? (
                                <img src={acc.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <Instagram className="w-5 h-5 text-zinc-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white truncate">{acc.name || acc.username}</p>
                              <p className="text-xs text-zinc-500 truncate">@{acc.username}</p>
                            </div>
                            
                            {formData.socialAccountId === acc.id && (
                              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500"></div>
                            )}
                          </div>
                          
                          {formData.socialAccountId === acc.id && (
                            <div className="col-span-1 sm:col-span-2 mt-2 flex justify-end">
                              {!acc.hasAutoDmToken ? (
                                <button 
                                  onClick={(e) => { e.preventDefault(); window.location.href=`/api/oauth/instagram-auto-dm/connect?accountId=${acc.id}`; }}
                                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2"
                                >
                                  <Instagram className="w-3.5 h-3.5" /> Enable Instagram Auto DM
                                </button>
                              ) : (
                                <div className="text-xs font-medium text-emerald-500 flex items-center gap-1.5 px-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Auto DM Active
                                </div>
                              )}
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Trigger Conditions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[16px] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/50 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center">
                  <span className="text-xs font-bold text-zinc-400">2</span>
                </div>
                <h2 className="text-base font-semibold text-white">Trigger Conditions</h2>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-zinc-300">Trigger Content / Media ID</label>
                    <button 
                      type="button" 
                      onClick={() => setUseManualMedia(!useManualMedia)}
                      className="text-xs text-zinc-400 hover:text-white font-medium transition-colors"
                    >
                      {useManualMedia ? "Use Post Browser" : "Enter ID Manually"}
                    </button>
                  </div>
                  
                  {useManualMedia ? (
                    <input
                      type="text"
                      name="mediaId"
                      value={formData.mediaId}
                      onChange={handleChange}
                      placeholder="e.g., 17981234567890 (Leave blank for ALL posts)"
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    />
                  ) : (
                    <div className="space-y-3">
                      {!formData.mediaId ? (
                        <div className="p-4 border border-dashed border-zinc-700 bg-black rounded-lg flex flex-col items-center justify-center gap-3 transition-colors hover:border-zinc-500">
                          <p className="text-sm text-zinc-400 text-center max-w-sm">No specific post selected. Automation will trigger on all eligible posts.</p>
                          <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors border border-zinc-700"
                          >
                            Browse Recent Posts
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-4 p-4 border border-zinc-700 bg-black rounded-lg relative group">
                          {selectedMedia ? (
                            <div className="w-16 h-16 rounded bg-zinc-900 shrink-0 overflow-hidden relative">
                              <img src={selectedMedia.thumbnail_url || selectedMedia.media_url} alt="Media" className="w-full h-full object-cover" />
                              <div className="absolute top-1 right-1 bg-black/60 p-0.5 rounded text-white backdrop-blur">
                                {selectedMedia.media_type === 'VIDEO' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                              </div>
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded bg-zinc-900 shrink-0 flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-zinc-700" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white mb-1 truncate">Media ID: {formData.mediaId}</p>
                            {selectedMedia?.caption && (
                              <p className="text-xs text-zinc-400 line-clamp-2">{selectedMedia.caption}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsModalOpen(true)}
                              className="text-xs text-zinc-300 hover:text-white bg-zinc-800 px-3 py-1.5 rounded"
                            >
                              Change Post
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, mediaId: "" }))}
                              className="text-xs text-red-400 hover:text-red-300 bg-red-400/10 px-3 py-1.5 rounded"
                            >
                              Clear Selection
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-zinc-500 mt-2 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Leave blank to trigger on comments across all eligible Instagram posts.
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 mt-4 mb-4">
                    <label className="block text-sm font-medium text-zinc-300 mb-3">Trigger Mode</label>
                    <div className="flex bg-black p-1 rounded-lg border border-zinc-800 mb-6">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, matchType: 'EXACT' }))}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${formData.matchType !== 'ANY_COMMENT' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Keyword Match
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, matchType: 'ANY_COMMENT', keyword: 'ANY' }))}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${formData.matchType === 'ANY_COMMENT' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Any Comment
                      </button>
                    </div>
                  </div>

                  {formData.matchType === 'ANY_COMMENT' ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-2">
                      <p className="text-sm font-medium text-red-400 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Any comment on the selected post will trigger this automation.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Trigger Keyword</label>
                        <input
                          type="text"
                          name="keyword"
                          value={formData.keyword}
                          onChange={handleChange}
                          placeholder="e.g., LINK"
                          className={`w-full bg-black border ${errors.keyword ? 'border-red-500' : 'border-zinc-800'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all`}
                        />
                        {errors.keyword && <p className="text-red-500 text-xs mt-1.5">{errors.keyword}</p>}
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
                      </div>
                    </div>
                  )}
                </div>
              </div>

            {/* Section 3: DM Response */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[16px] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/50 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center">
                  <span className="text-xs font-bold text-zinc-400">3</span>
                </div>
                <h2 className="text-base font-semibold text-white">Automatic DM</h2>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Message Content</label>
                  <textarea
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Thanks for commenting! Here is the link you requested 👇"
                    className={`w-full bg-black border ${errors.message ? 'border-red-500' : 'border-zinc-800'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-y`}
                  ></textarea>
                  <div className="flex items-center justify-between mt-1.5">
                    {errors.message ? (
                      <p className="text-red-500 text-xs">{errors.message}</p>
                    ) : (
                      <p className="text-xs text-zinc-500">Supports text and emojis.</p>
                    )}
                    <p className="text-xs text-zinc-500 font-mono">{formData.message.length}/1000</p>
                  </div>
                </div>

                <div className="border-t border-zinc-800/60 pt-6">
                  <label className="flex items-center justify-between cursor-pointer p-4 bg-black border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
                    <div>
                      <span className="block text-sm font-medium text-white">Add Link Button</span>
                      <span className="block text-xs text-zinc-500 mt-0.5">Attach a clickable URL button below the message.</span>
                    </div>
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.includeButton ? 'bg-red-500' : 'bg-zinc-700'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${formData.includeButton ? 'translate-x-4.5' : 'translate-x-1'}`} style={{ transform: formData.includeButton ? 'translateX(18px)' : 'translateX(4px)' }} />
                    </div>
                    <input type="checkbox" name="includeButton" checked={formData.includeButton} onChange={handleChange} className="hidden" />
                  </label>

                  {formData.includeButton && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-5 bg-black border border-zinc-800 rounded-lg">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Button Label</label>
                        <input
                          type="text"
                          name="buttonLabel"
                          value={formData.buttonLabel}
                          onChange={handleChange}
                          placeholder="e.g., View Product"
                          className={`w-full bg-zinc-900 border ${errors.buttonLabel ? 'border-red-500' : 'border-zinc-700'} rounded-md px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500`}
                        />
                        {errors.buttonLabel && <p className="text-red-500 text-xs mt-1">{errors.buttonLabel}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Destination URL</label>
                        <input
                          type="url"
                          name="destinationUrl"
                          value={formData.destinationUrl}
                          onChange={handleChange}
                          placeholder="https://"
                          className={`w-full bg-zinc-900 border ${errors.destinationUrl ? 'border-red-500' : 'border-zinc-700'} rounded-md px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500`}
                        />
                        {errors.destinationUrl && <p className="text-red-500 text-xs mt-1">{errors.destinationUrl}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Automation Status */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-[16px] overflow-hidden">
              <label className="flex items-center justify-between cursor-pointer p-6">
                <div>
                  <span className="block text-sm font-semibold text-white">Enable Automation</span>
                  <span className="block text-xs text-zinc-400 mt-1">If enabled, this rule will be active immediately.</span>
                </div>
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enabled ? 'bg-red-500' : 'bg-zinc-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
                <input type="checkbox" name="enabled" checked={formData.enabled} onChange={handleChange} className="hidden" />
              </label>
            </div>
            
          </div>

          {/* Right Column: Sticky Summary/Preview */}
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-24 space-y-6">
              
              {/* Live Rule Summary */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-[16px] shadow-sm p-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Rule Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5"><MessageCircle className="w-4 h-4 text-zinc-400" /></div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {formData.matchType === 'ANY_COMMENT' ? (
                        <span>When someone comments <span className="text-white font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-xs">anything</span></span>
                      ) : (
                        <span>When someone comments <span className="text-white font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{formData.keyword || "..."}</span></span>
                      )}
                    </p>
                  </div>
                  {formData.mediaId && (
                    <div className="flex items-start gap-3 mt-2">
                      <div className="mt-0.5"><ImageIcon className="w-4 h-4 text-zinc-400" /></div>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        On specific post <span className="text-white font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{formData.mediaId}</span>
                      </p>
                    </div>
                  )}
                  <div className="flex items-start gap-3 pl-1">
                    <div className="border-l-2 border-zinc-700 h-6"></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5"><Instagram className="w-4 h-4 text-red-400" /></div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Send a private DM from <span className="font-semibold text-white">{selectedAccount ? `@${selectedAccount.username}` : "account"}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* DM Preview */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-[16px] shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400">DM PREVIEW</span>
                  {selectedAccount && <span className="text-[10px] text-zinc-500">@{selectedAccount.username}</span>}
                </div>
                
                <div className="p-5 bg-black flex-1 min-h-[200px] flex flex-col justify-end">
                  <div className="flex items-end gap-2 max-w-[90%] mb-2">
                    {selectedAccount?.profileImageUrl ? (
                      <img src={selectedAccount.profileImageUrl} alt="User" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-zinc-800 shrink-0"></div>
                    )}
                    <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-2.5">
                      <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">
                        {formData.message || <span className="text-zinc-500 italic">Your message will appear here...</span>}
                      </p>
                    </div>
                  </div>
                  
                  {formData.includeButton && formData.buttonLabel && (
                    <div className="pl-8 max-w-[90%]">
                      <div className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-center mt-1">
                        <span className="text-[13px] font-semibold text-blue-400">{formData.buttonLabel}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Mobile Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-zinc-800 sm:hidden z-40">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 text-white px-5 py-3 rounded-lg text-sm font-bold shadow-lg shadow-red-900/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {loading ? "Saving..." : "Save Automation"}
        </button>
      </div>

      {/* Post Selector Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-zinc-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0a0a0a]">
              <div>
                <h3 className="text-lg font-bold text-white">Select Instagram Post</h3>
                <p className="text-xs text-zinc-400">Choose a post to trigger this automation on.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loadingMedia ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
                  <p className="text-sm text-zinc-400">Loading recent posts...</p>
                </div>
              ) : mediaError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                    <Info className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-sm font-medium text-white">{mediaError}</p>
                  <p className="text-xs text-zinc-400 max-w-sm">Make sure you have an active Instagram connection with media permissions.</p>
                </div>
              ) : mediaList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Instagram className="w-10 h-10 text-zinc-600 mb-4" />
                  <p className="text-sm font-medium text-white">No posts found</p>
                  <p className="text-xs text-zinc-400 mt-1">This account has no recent posts.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mediaList.map((media) => {
                    const isSelected = formData.mediaId === media.id;
                    const imageUrl = media.thumbnail_url || media.media_url;
                    return (
                      <div
                        key={media.id}
                        onClick={() => handleMediaSelect(media.id)}
                        className={`relative cursor-pointer group rounded-xl overflow-hidden border-2 transition-all bg-black flex flex-col ${isSelected ? 'border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : 'border-zinc-800 hover:border-zinc-600'}`}
                      >
                        <div className="relative aspect-square bg-zinc-900 w-full overflow-hidden">
                          {imageUrl ? (
                            <img src={imageUrl} alt="Post preview" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {media.media_type === 'VIDEO' ? <Video className="w-6 h-6 text-zinc-700" /> : <ImageIcon className="w-6 h-6 text-zinc-700" />}
                            </div>
                          )}
                          
                          {/* Media Type Icon */}
                          <div className="absolute top-2 right-2 bg-black/60 p-1 rounded-md text-white backdrop-blur">
                            {media.media_type === 'VIDEO' ? <Video className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                          </div>
                          
                          {isSelected && (
                            <div className="absolute inset-0 bg-red-500/20 pointer-events-none"></div>
                          )}
                        </div>
                        
                        <div className="p-3 bg-zinc-900/80 flex-1 flex flex-col justify-between">
                          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed mb-2">
                            {media.caption || <span className="italic text-zinc-600">No caption</span>}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-medium">
                            {formatDate(media.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-zinc-800 bg-[#0a0a0a] flex items-center justify-between">
              <p className="text-xs text-zinc-500">Only the latest posts are shown.</p>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
