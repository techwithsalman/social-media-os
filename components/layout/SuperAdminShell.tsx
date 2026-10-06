'use client';

import React, { useState } from 'react';
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
  Menu,
  X
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  React.useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileSidebarOpen]);

  return (
    <div className="min-h-screen bg-[#070b14] text-neutral-100 flex">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 w-72 bg-[#050202] border-r border-[#2a1010] flex flex-col shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-20 px-6 flex items-center justify-between gap-3 border-b border-[#2a1010] bg-[#060a12]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center border border-amber-500/30 shadow-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-lg font-black text-white tracking-tight">Super Admin</p>
              <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">Social Media OS</p>
            </div>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-2 -mr-2 text-neutral-400 hover:text-white hover:bg-[#1a0a0a] rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-md'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#1a0a0a]/70'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-300' : 'text-neutral-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#2a1010] bg-[#060a12]">
          <Link
            href="/dashboard"
            className="block mb-3 px-4 py-2.5 rounded-xl bg-[#0f0505] hover:bg-[#1a0a0a] border border-[#2a1010] text-sm font-bold text-neutral-200 text-center"
          >
            Back to App
          </Link>
          <div className="p-3 rounded-xl bg-[#0f0505]/80 border border-[#2a1010]">
            <p className="text-sm font-black text-white truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-neutral-400 truncate mt-0.5">{user.email}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 lg:pl-72 w-full">
        <div className="sticky top-0 z-30 h-20 px-6 lg:px-8 flex items-center justify-between border-b border-[#2a1010] bg-[#050202]/92 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2.5 -ml-2 rounded-xl text-neutral-400 hover:text-white hover:bg-[#1a0a0a] lg:hidden transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-amber-300">System Control</p>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight truncate">SaaS Administration</h1>
            </div>
          </div>
          <div className="hidden sm:block px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black shrink-0">
            Server Guard Active
          </div>
        </div>

        <div className="flex-1 p-4 md:p-8 max-w-[1500px] w-full mx-auto overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
