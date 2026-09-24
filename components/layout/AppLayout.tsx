'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NotificationsDrawer } from './NotificationsDrawer';

interface AppLayoutProps {
  children: React.ReactNode;
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
  title?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  user,
  workspace,
  title,
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex">
      {/* Left Sidebar (w-72) */}
      <Sidebar
        user={user}
        workspace={workspace}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        <Header
          title={title}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          unreadCount={unreadCount}
        />

        <main className="flex-1 p-6 md:p-10 max-w-[1440px] w-full mx-auto pb-24">
          {children}
        </main>
      </div>

      {/* Notification Drawer */}
      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onUpdateUnreadCount={(c) => setUnreadCount(c)}
      />
    </div>
  );
};
