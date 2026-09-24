import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlatformIcon } from '@/components/ui/PlatformIcons';
import { WORKSPACE_TIMEZONE, formatDateInTimeZone, formatTimeInTimeZone } from '@/lib/timezone';
import { SUPPORTED_PLATFORM_CONFIGS } from '@/lib/platforms';
import {
  Share2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  ArrowUpRight,
  Sparkles,
  Calendar as CalendarIcon,
  Activity,
  Layers,
} from 'lucide-react';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user || !user.activeWorkspace) {
    redirect('/login');
  }

  const workspaceId = user.activeWorkspace.id;
  const workspaceTimezone = user.activeWorkspace.timezone || WORKSPACE_TIMEZONE;

  // Query database statistics & records
  const [
    connectedAccountsCount,
    scheduledPostsCount,
    publishedPostsCount,
    failedPostsCount,
    draftsCount,
    connectedAccounts,
    upcomingPosts,
    recentActivity,
  ] = await Promise.all([
    prisma.socialAccount.count({
      where: { workspaceId, status: 'CONNECTED' },
    }),
    prisma.contentPost.count({
      where: { workspaceId, status: 'SCHEDULED' },
    }),
    prisma.contentPost.count({
      where: { workspaceId, status: { in: ['PUBLISHED', 'INBOX_DRAFT', 'PARTIALLY_FAILED'] } },
    }),
    prisma.contentPost.count({
      where: { workspaceId, status: 'FAILED' },
    }),
    prisma.contentPost.count({
      where: { workspaceId, status: 'DRAFT' },
    }),
    prisma.socialAccount.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.contentPost.findMany({
      where: { workspaceId, status: 'SCHEDULED' },
      include: {
        mediaAsset: true,
        platformPosts: {
          include: {
            socialAccount: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 5,
    }),
    prisma.activityLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  const allSupportedPlatforms = SUPPORTED_PLATFORM_CONFIGS.map((platform) => ({
    platform: platform.id,
    name: platform.dashboardName,
    desc: platform.dashboardDesc,
  }));

  return (
    <AppLayout
      user={user}
      workspace={{
        name: user.activeWorkspace.name,
        plan: user.activeWorkspace.plan,
      }}
      title="Dashboard Overview"
    >
      {/* Premium Spacious Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/50 via-purple-900/30 to-slate-900/80 border border-indigo-500/25 p-8 md:p-12 mb-10 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-bold mb-4 shadow-sm">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Unified Command Center</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Welcome back, {user.firstName}!
            </h1>
            <p className="text-slate-300 text-base md:text-lg mt-3 leading-relaxed">
              <strong className="text-white font-bold">One Content → Every Platform.</strong> Compose once and effortlessly broadcast across Instagram, Facebook, TikTok, LinkedIn, YouTube, X, Pinterest, and Snapchat from a single operating system.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <Link
              href="/create-post"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-base font-bold shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>Compose Post</span>
            </Link>
            <Link
              href="/bulk-upload"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700 text-base font-bold transition-all hover:border-slate-600 shadow-md"
            >
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Bulk Upload</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Spacious Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-6 mb-12">
        <div className="p-6 rounded-2xl bg-[#0d1322] border border-slate-800 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider">
              Connected
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-black text-white mt-3">
              {connectedAccountsCount}
            </p>
            <p className="text-sm text-slate-400 mt-1">Active channels</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#0d1322] border border-slate-800 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider">
              Scheduled
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-black text-white mt-3">
              {scheduledPostsCount}
            </p>
            <p className="text-sm text-slate-400 mt-1">Ready in queue</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#0d1322] border border-slate-800 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider">
              Published
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-black text-white mt-3">
              {publishedPostsCount}
            </p>
            <p className="text-sm text-slate-400 mt-1">Live broadcasts</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#0d1322] border border-slate-800 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider">
              Failed
            </span>
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-black text-white mt-3">
              {failedPostsCount}
            </p>
            <p className="text-sm text-slate-400 mt-1">Needs attention</p>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-6 rounded-2xl bg-[#0d1322] border border-slate-800 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider">
              Drafts
            </span>
            <div className="p-2.5 rounded-xl bg-slate-500/10 text-slate-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-black text-white mt-3">
              {draftsCount}
            </p>
            <p className="text-sm text-slate-400 mt-1">Unpublished ideas</p>
          </div>
        </div>
      </div>

      {/* Connected Accounts Section */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Connected Social Channels
            </h2>
            <p className="text-sm md:text-base text-slate-400 mt-1">
              Live status and account connections across all supported networks
            </p>
          </div>
          <Link
            href="/accounts"
            className="text-sm md:text-base font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
          >
            <span>Manage All Channels</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {allSupportedPlatforms.map((plat) => {
            const connectedAcc = connectedAccounts.find(
              (acc) => acc.platform === plat.platform
            );
            const isConnected = !!connectedAcc;

            return (
              <div
                key={plat.platform}
                className={`p-6 rounded-2xl border transition-all flex flex-col justify-between min-h-[160px] ${
                  isConnected
                    ? 'bg-[#0d1322] border-slate-800 hover:border-slate-700 shadow-md'
                    : 'bg-[#0a0f1c]/70 border-slate-800/70 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <PlatformIcon platform={plat.platform} size={36} className="w-9 h-9 rounded-xl shrink-0" />
                      <div>
                        <h3 className="text-base font-bold text-white">
                          {isConnected ? connectedAcc.name : plat.name}
                        </h3>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {isConnected ? `@${connectedAcc.username}` : plat.desc}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                        isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isConnected ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                    </span>
                  </div>
                </div>

                {isConnected && (
                  <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="text-amber-400 font-semibold">
                      Development Simulation
                    </span>
                    <Link
                      href="/accounts"
                      className="text-slate-300 hover:text-white font-semibold transition-colors"
                    >
                      Configure &rarr;
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Upcoming Scheduled Posts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Posts Feed (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Upcoming Scheduled Broadcasts
                </h3>
              </div>
              <Link
                href="/scheduled"
                className="text-sm font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
              >
                <span>View Queue ({scheduledPostsCount})</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            {upcomingPosts.length === 0 ? (
              <div className="text-center py-14 px-6 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-200">
                  No upcoming posts scheduled
                </p>
                <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                  Queue your content in advance or click &apos;Seed Demo Data&apos; above to preview realistic workflows.
                </p>
                <Link
                  href="/create-post"
                  className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule First Post</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-slate-700 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      {/* Media Thumbnail */}
                      <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700/80 flex items-center justify-center">
                        {post.mediaAsset?.thumbnailUrl || post.mediaAsset?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.mediaAsset.thumbnailUrl || post.mediaAsset.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText className="w-7 h-7 text-slate-500" />
                        )}
                      </div>

                      {/* Content Preview & Platform Icons */}
                      <div className="overflow-hidden">
                        <p className="text-sm md:text-base font-bold text-slate-100 truncate">
                          {post.masterCaption}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            {post.platformPosts.map((p) => (
                              <PlatformIcon
                                key={p.id}
                                platform={p.platform}
                                size={18}
                                className="w-4.5 h-4.5 rounded"
                              />
                            ))}
                          </div>
                          <span className="text-xs text-slate-400 font-semibold">
                            • {post.platformPosts.length} channel(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Time & Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <div className="text-left sm:text-right">
                        <p className="text-sm md:text-base font-bold text-white">
                          {post.scheduledFor
                            ? formatDateInTimeZone(
                                post.scheduledFor,
                                post.timezone || workspaceTimezone
                              )
                            : 'N/A'}
                        </p>
                        <p className="text-xs md:text-sm text-indigo-400 font-bold">
                          {post.scheduledFor
                            ? formatTimeInTimeZone(
                                post.scheduledFor,
                                post.timezone || workspaceTimezone
                              )
                            : ''}
                        </p>
                      </div>
                      <Link
                        href="/scheduled"
                        className="px-3.5 py-2 text-xs md:text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400 font-medium">
            <span>Automated Queue Engine: Active</span>
            <Link href="/calendar" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              Open Content Calendar &rarr;
            </Link>
          </div>
        </div>

        {/* Recent Activity Log (1 Col) */}
        <div className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <Activity className="w-5 h-5 text-indigo-400" />
              <h3 className="text-xl font-bold text-white tracking-tight">
                Recent Activity
              </h3>
            </div>

            {recentActivity.length === 0 ? (
              <div className="text-center py-14 text-slate-500 text-sm">
                No recent activity recorded yet.
              </div>
            ) : (
              <div className="space-y-3.5">
                {recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 text-sm shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">
                        {act.action.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(act.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-200 mt-1.5 text-sm leading-relaxed">
                      {act.details}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 font-semibold">
            Audit Trail Multi-Tenancy Active
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
