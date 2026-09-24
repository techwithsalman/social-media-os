'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';

const adminNavItems = [
  { label: 'Overview', href: '/super-admin', icon: LayoutDashboard },
  { label: 'Users', href: '/super-admin/users', icon: Users },
  { label: 'Workspaces', href: '/super-admin/workspaces', icon: Database },
  { label: 'Plans', href: '/super-admin/plans', icon: ListChecks },
  { label: 'Subscriptions', href: '/super-admin/subscriptions', icon: CreditCard },
  { label: 'Payments', href: '/super-admin/payments', icon: WalletCards },
  { label: 'Billing', href: '/super-admin/billing', icon: DollarSign },
  { label: 'Usage', href: '/super-admin/usage', icon: BarChart3 },
  { label: 'Publishing', href: '/super-admin/publishing', icon: FileText },
  { label: 'Activity Logs', href: '/super-admin/activity', icon: Activity },
  { label: 'System Health', href: '/super-admin/system-health', icon: HeartPulse },
  { label: 'Settings', href: '/super-admin/settings', icon: Settings },
];

interface SuperAdminShellProps {
  children: React.ReactNode;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export function SuperAdminShell({ children, user }: SuperAdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex">
      <aside className="fixed left-0 top-0 bottom-0 z-40 w-72 bg-[#080d18] border-r border-slate-800 flex flex-col shadow-2xl">
        <div className="h-20 px-6 flex items-center gap-3 border-b border-slate-800 bg-[#060a12]">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center border border-amber-500/30 shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-lg font-black text-white tracking-tight">Super Admin</p>
            <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">Social Media OS</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-md'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-[#060a12]">
          <Link
            href="/dashboard"
            className="block mb-3 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-bold text-slate-200"
          >
            Back to App
          </Link>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <p className="text-sm font-black text-white truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pl-72">
        <div className="sticky top-0 z-20 h-20 px-8 flex items-center justify-between border-b border-slate-800 bg-[#080d18]/92 backdrop-blur-xl">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-amber-300">System Control</p>
            <h1 className="text-2xl font-black text-white tracking-tight">SaaS Administration</h1>
          </div>
          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black">
            Server Guard Active
          </div>
        </div>

        <div className="p-8 max-w-[1500px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
