import Link from 'next/link';
import { getAdminOverview } from '@/lib/admin-data';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  HardDrive,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

const statIcons = {
  users: Users,
  active: CheckCircle2,
  trial: Clock,
  paid: CreditCard,
  suspended: AlertTriangle,
  workspace: Database,
  accounts: ShieldCheck,
  posts: WalletCards,
  storage: HardDrive,
};

export default async function SuperAdminOverviewPage() {
  const overview = await getAdminOverview();
  const stats = [
    { label: 'Total Users', value: overview.stats.totalUsers, icon: statIcons.users, color: 'text-indigo-300' },
    { label: 'Active Users', value: overview.stats.activeUsers, icon: statIcons.active, color: 'text-emerald-300' },
    { label: 'Trial Users', value: overview.stats.trialUsers, icon: statIcons.trial, color: 'text-sky-300' },
    { label: 'Paid Users', value: overview.stats.paidUsers, icon: statIcons.paid, color: 'text-purple-300' },
    { label: 'Suspended Users', value: overview.stats.suspendedUsers, icon: statIcons.suspended, color: 'text-red-300' },
    { label: 'Total Workspaces', value: overview.stats.totalWorkspaces, icon: statIcons.workspace, color: 'text-cyan-300' },
    { label: 'Connected Accounts', value: overview.stats.connectedSocialAccounts, icon: statIcons.accounts, color: 'text-amber-300' },
    { label: 'Posts Published This Month', value: overview.stats.postsPublishedThisMonth, icon: statIcons.posts, color: 'text-emerald-300' },
    { label: 'Posts Scheduled', value: overview.stats.postsScheduled, icon: statIcons.trial, color: 'text-blue-300' },
    { label: 'Failed Posts', value: overview.stats.failedPosts, icon: statIcons.suspended, color: 'text-rose-300' },
    { label: 'MRR Placeholder', value: '$0', icon: statIcons.paid, color: 'text-lime-300' },
    { label: 'Storage Used', value: formatBytes(overview.stats.storageUsedBytes), icon: statIcons.storage, color: 'text-teal-300' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-amber-300">Overview</p>
          <h2 className="text-3xl font-black text-white tracking-tight mt-1">Platform Command Center</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            System-wide SaaS, usage, billing, publishing, and workspace health across Social Media OS.
          </p>
        </div>
        <Link
          href="/super-admin/users"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-sm font-black"
        >
          <span>Manage Users</span>
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl bg-[#0d1322] border border-slate-800 p-5 min-h-[132px]">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">{stat.label}</p>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-3xl font-black text-white mt-7">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-[#0d1322] border border-slate-800 p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <h3 className="text-lg font-black text-white">Recent Activity</h3>
            <Link href="/super-admin/activity" className="text-sm font-bold text-amber-300 hover:text-amber-200">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {overview.recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No system activity yet.</p>
            ) : (
              overview.recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-xl bg-slate-950/60 border border-slate-800 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      {activity.action.replaceAll('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1.5">{activity.details || 'No details recorded.'}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[#0d1322] border border-slate-800 p-6">
          <h3 className="text-lg font-black text-white pb-4 border-b border-slate-800 mb-4">Recent Users</h3>
          <div className="space-y-3">
            {overview.recentUsers.map((user) => (
              <Link
                key={user.id}
                href={`/super-admin/users/${user.id}`}
                className="block rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-slate-800 px-4 py-3"
              >
                <p className="text-sm font-black text-white">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
