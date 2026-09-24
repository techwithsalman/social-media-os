'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  User,
  Building,
  Globe,
  Bell,
  Key,
  Shield,
  Save,
  CheckCircle2,
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'WORKSPACE' | 'TIMEZONE' | 'NOTIFICATIONS' | 'SECURITY'>('PROFILE');
  const [saved, setSaved] = useState(false);

  const [firstName, setFirstName] = useState('Alex');
  const [lastName, setLastName] = useState('Rivera');
  const [email, setEmail] = useState('alex@socialos.dev');
  const [workspaceName, setWorkspaceName] = useState("Alex's Studio Workspace");
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [failedPostAlerts, setFailedPostAlerts] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    { id: 'PROFILE', label: 'User Profile', icon: User },
    { id: 'WORKSPACE', label: 'Workspace Details', icon: Building },
    { id: 'TIMEZONE', label: 'Timezone & Localization', icon: Globe },
    { id: 'NOTIFICATIONS', label: 'Notification Alerts', icon: Bell },
    { id: 'SECURITY', label: 'Security & Token Keys', icon: Shield },
  ];

  return (
    <AppLayout title="Workspace & Account Settings">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Settings & Preferences
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1.5">
            Configure your user profile, timezone preferences, workspace branding, and security policies.
          </p>
        </div>

        {saved && (
          <div className="px-4 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Navigation Tabs (4 Cols) */}
        <div className="lg:col-span-4 space-y-2 bg-[#0d1322] border border-slate-800 rounded-3xl p-4 shadow-md h-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3.5 px-5 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Settings Form (8 Cols) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSave} className="bg-[#0d1322] border border-slate-800 rounded-3xl p-7 md:p-10 shadow-md space-y-8">
            {activeTab === 'PROFILE' && (
              <div className="space-y-6">
                <h3 className="text-base md:text-lg font-bold text-white border-b border-slate-800 pb-4">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full p-3.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full p-3.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {activeTab === 'WORKSPACE' && (
              <div className="space-y-6">
                <h3 className="text-base md:text-lg font-bold text-white border-b border-slate-800 pb-4">
                  Workspace Configuration
                </h3>
                <div>
                  <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">Workspace Name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full p-3.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">Storage Mode</label>
                  <select className="w-full p-3.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white">
                    <option value="local">Local Development Storage (/public/uploads)</option>
                    <option value="s3">Amazon Web Services S3</option>
                    <option value="r2">Cloudflare R2 Bucket</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'TIMEZONE' && (
              <div className="space-y-6">
                <h3 className="text-base md:text-lg font-bold text-white border-b border-slate-800 pb-4">
                  Timezone & Scheduling Defaults
                </h3>
                <div>
                  <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">Default Workspace Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full p-3.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="Asia/Karachi">Asia/Karachi (PKT UTC+05:00)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'NOTIFICATIONS' && (
              <div className="space-y-6">
                <h3 className="text-base md:text-lg font-bold text-white border-b border-slate-800 pb-4">
                  Alert Preferences
                </h3>
                <div className="space-y-4">
                  <label className="flex items-start gap-3.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 w-5 h-5 mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Publishing Notifications</p>
                      <p className="text-xs md:text-sm text-slate-400 mt-0.5">Receive alerts whenever scheduled content is broadcast.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={failedPostAlerts}
                      onChange={(e) => setFailedPostAlerts(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 w-5 h-5 mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Failed Post Alerts & Token Expiry</p>
                      <p className="text-xs md:text-sm text-slate-400 mt-0.5">Immediate high-priority notification if any platform API rejects a post.</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'SECURITY' && (
              <div className="space-y-6">
                <h3 className="text-base md:text-lg font-bold text-white border-b border-slate-800 pb-4">
                  Security & Token Encryption
                </h3>
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2.5 text-emerald-400 text-sm font-bold">
                    <Shield className="w-5 h-5" />
                    <span>AES-256-CBC Token Encryption Active</span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    All connected social platform OAuth tokens are encrypted at rest with server-side keys before writing to the database.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
