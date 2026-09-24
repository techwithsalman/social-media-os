'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import {
  BarChart3,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Users,
  Calendar,
  Sparkles,
} from 'lucide-react';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30D');

  const metrics = [
    { label: 'Total Impressions', value: '184.2K', change: '+18.4%', icon: Eye, color: 'text-indigo-400' },
    { label: 'Total Reach', value: '92.6K', change: '+12.1%', icon: Users, color: 'text-blue-400' },
    { label: 'Engagement Rate', value: '4.85%', change: '+0.6%', icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Total Likes', value: '14.8K', change: '+24.5%', icon: Heart, color: 'text-rose-400' },
    { label: 'Comments', value: '1.92K', change: '+8.3%', icon: MessageCircle, color: 'text-amber-400' },
    { label: 'Shares / Retweets', value: '840', change: '+15.2%', icon: Share2, color: 'text-purple-400' },
  ];

  const platformBreakdown = [
    { platform: 'INSTAGRAM', followers: '24.5K', views: '78.2K', engagement: '5.2%', posts: 14 },
    { platform: 'TIKTOK', followers: '52.1K', views: '64.5K', engagement: '6.8%', posts: 18 },
    { platform: 'YOUTUBE', followers: '18.9K', views: '28.4K', engagement: '4.1%', posts: 6 },
    { platform: 'LINKEDIN', followers: '8.4K', views: '14.2K', engagement: '3.6%', posts: 9 },
    { platform: 'FACEBOOK', followers: '12.8K', views: '9.8K', engagement: '2.4%', posts: 12 },
    { platform: 'X', followers: '15.6K', views: '11.5K', engagement: '3.1%', posts: 21 },
  ];

  return (
    <AppLayout title="Performance & Analytics">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Cross-Platform Analytics
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1.5">
            Aggregated audience growth, content engagement, and network metrics across all channels.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center bg-[#0d1322] border border-slate-800 rounded-2xl p-1.5 text-sm font-bold shadow-sm">
          {['7D', '30D', '90D', 'YTD'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-1.5 rounded-xl transition-all ${
                dateRange === range
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-10">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="p-5 md:p-6 rounded-2xl bg-[#0d1322] border border-slate-800 shadow-sm flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {m.label}
                </span>
                <Icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-black text-white mt-2">{m.value}</p>
                <p className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                  <span>{m.change}</span>
                  <span className="text-slate-500 font-normal">vs last period</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Platform Performance Table */}
      <div className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md mb-10">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg md:text-xl font-bold text-white">Platform Performance Breakdown</h3>
          </div>
          <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
            Real-Time API Sync Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs font-bold">
                <th className="pb-4">Channel</th>
                <th className="pb-4">Audience / Followers</th>
                <th className="pb-4">Total Views</th>
                <th className="pb-4">Engagement Rate</th>
                <th className="pb-4">Broadcasts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {platformBreakdown.map((item) => (
                <tr key={item.platform} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-4 flex items-center gap-3">
                    <PlatformIcon platform={item.platform} size={24} className="w-6 h-6 rounded-lg" />
                    <span className="font-bold text-white text-base">{item.platform}</span>
                  </td>
                  <td className="py-4 font-bold text-slate-200">{item.followers}</td>
                  <td className="py-4 font-bold text-slate-200">{item.views}</td>
                  <td className="py-4 font-black text-emerald-400">{item.engagement}</td>
                  <td className="py-4 text-slate-400 font-semibold">{item.posts} posts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
