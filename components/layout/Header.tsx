'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Menu,
  Bell,
  Plus,
  Sparkles,
  Database,
  Check,
} from 'lucide-react';
import {
  INTERNAL_FALLBACK_ROUTE,
  isInternalAppRoute,
  rememberInternalRoute,
  resolveInternalBackTarget,
} from '@/lib/internalNavigation';

const COMPOSER_DRAFT_KEY = 'smos:create-post-composer';

interface HeaderProps {
  onOpenMobileSidebar?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onOpenNotifications,
  unreadCount = 0,
  title,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  useEffect(() => {
    const currentPath = `${pathname}${window.location.search}`;
    if (isInternalAppRoute(currentPath)) {
      rememberInternalRoute(currentPath);
    }
  }, [pathname]);

  const showBackButton =
    isInternalAppRoute(pathname) && pathname !== INTERNAL_FALLBACK_ROUTE;

  const handleInternalBack = () => {
    const currentPath = `${pathname}${window.location.search}`;
    router.push(resolveInternalBackTarget(currentPath));
  };

  const handleSeedDemo = async () => {
    try {
      setSeeding(true);
      window.sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
      window.localStorage.removeItem(COMPOSER_DRAFT_KEY);
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        setSeedSuccess(true);
        setTimeout(() => setSeedSuccess(false), 3000);
        if (pathname === '/create-post') {
          window.location.reload();
        } else {
          router.refresh();
        }
      }
    } catch (e) {
      console.error('Seed error:', e);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-20 px-6 md:px-10 bg-[#080d18]/90 backdrop-blur-xl border-b border-slate-800 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2.5 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        {showBackButton && (
          <button
            type="button"
            onClick={handleInternalBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-300 bg-slate-900/80 hover:bg-slate-800 hover:text-white border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {title || 'Dashboard Overview'}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mock Mode Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Development Simulation</span>
        </div>

        {/* Quick Seed Demo Data */}
        <button
          onClick={handleSeedDemo}
          disabled={seeding}
          title="Seed realistic demo accounts and scheduled posts"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/90 transition-all duration-150 shadow-sm disabled:opacity-50"
        >
          {seeding ? (
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : seedSuccess ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Database className="w-4 h-4 text-indigo-400" />
          )}
          <span className="hidden md:inline">
            {seeding ? 'Seeding...' : seedSuccess ? 'Data Loaded!' : 'Seed Demo Data'}
          </span>
        </button>

        {/* Notifications Icon */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
          )}
        </button>

        {/* Fast Action: Create Post */}
        <Link
          href="/create-post"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Post</span>
        </Link>
      </div>
    </header>
  );
};
