'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  Layers,
  Calendar,
  Clock,
  CheckCircle2,
  Share2,
  BarChart3,
  MessageCircle,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    systemRole?: string;
  };
  workspace?: {
    name: string;
    plan: string;
  };
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Create Post', href: '/create-post', icon: PlusCircle, badge: 'New' },
  { label: 'Bulk Upload', href: '/bulk-upload', icon: Layers },
  { label: 'Content Calendar', href: '/calendar', icon: Calendar },
  { label: 'Scheduled Posts', href: '/scheduled', icon: Clock },
  { label: 'Published Posts', href: '/published', icon: CheckCircle2 },
  { label: 'Connected Accounts', href: '/accounts', icon: Share2 },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Instagram Auto DM', href: '/instagram-auto-dm', icon: MessageCircle, badge: 'Beta' },
  { label: 'Facebook Auto DM', href: '/facebook-auto-dm', icon: MessageCircle, badge: 'Beta' },
  { label: 'Team', href: '/team', icon: Users },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  workspace,
  isOpenMobile,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [hydratedUser, setHydratedUser] = useState(user);
  const [hydratedWorkspace, setHydratedWorkspace] = useState(workspace);

  useEffect(() => {
    if (user && workspace) return;

    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setHydratedUser(data.user);
        setHydratedWorkspace(data.activeWorkspace);
      })
      .catch(() => {
        // Sidebar identity is decorative; protected APIs still enforce access.
      });
  }, [user, workspace]);

  const resolvedUser = user || hydratedUser;
  const resolvedWorkspace = workspace || hydratedWorkspace;
  const isSuperAdmin = resolvedUser?.systemRole === 'SUPER_ADMIN';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-72 bg-[#0a0a0c] border-r border-[#2a1010] shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 h-20 border-b border-[#2a1010]/90 bg-[#0a0a0c]">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-[85px] h-auto shrink-0 mb-1"><img src="/tws-logo-transparent.png" alt="Logo" className="w-full h-auto object-contain" /></div><div className="flex flex-col justify-center"><h1 className="text-[13px] font-black tracking-tight text-white uppercase leading-tight"><span className="text-red-500">TECH</span> WITH <span className="text-red-500">SALMAN</span></h1><p className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest leading-tight">Social Media <span className="text-red-500">OS</span></p></div>
          </div>
          {/* Close button for mobile */}
          {isOpenMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 -mr-2 text-neutral-400 hover:text-white hover:bg-[#1a0a0a] rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>

        {/* Workspace Quick Switcher */}
        <div className="px-5 py-4 border-b border-[#2a1010]/80 bg-[#0f0f13]/60">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#100606]/90 border border-[#2a1010]">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-red-600/30 text-red-400 flex items-center justify-center text-sm font-bold shrink-0 border border-red-500/30">
                {resolvedWorkspace?.name?.charAt(0) || 'W'}
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-neutral-100 truncate">
                  {resolvedWorkspace?.name || 'My Workspace'}
                </p>
                <p className="text-xs text-red-500 font-semibold capitalize">
                  {resolvedWorkspace?.plan || 'Free'} Plan
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
              return (
                <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`group flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-red-950/80 to-[#1f0a0a] border border-red-500/30 text-white shadow-[0_0_15px_rgba(220,38,38,0.15)] font-bold'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#1a0a0a]/60'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive
                        ? 'text-red-500'
                        : 'text-neutral-400 group-hover:text-neutral-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {isSuperAdmin && (
            <Link
              href="/super-admin"
              onClick={onCloseMobile}
              className={`group flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                pathname.startsWith('/super-admin')
                  ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-md'
                  : 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <ShieldCheck className="w-5 h-5 text-amber-300" />
                <span>Super Admin</span>
              </div>
            </Link>
          )}
        </div>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-[#2a1010] bg-[#0a0a0c]/90">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#100606]/80 border border-[#2a1010]">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 to-red-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-lg">
                {resolvedUser?.firstName?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-neutral-100 truncate">
                  {resolvedUser?.firstName} {resolvedUser?.lastName}
                </p>
                <p className="text-xs text-neutral-400 truncate">{resolvedUser?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};


