'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  MessageCircle,
  Video,
  Radio,
  Bookmark,
  Compass,
  Users,
  Settings,
  Sparkles,
  ShieldCheck,
  Heart,
  Plus,
  LogOut,
  User,
  Bell,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { UserAvatar } from './UserAvatar';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { currentUser, unreadMessagesCount, unreadNotificationsCount } = useStore();

  const navItems = [
    { label: 'Home Feed', href: '/', icon: Home },
    { label: 'Friends', href: '/friends', icon: Users },
    {
      label: 'Notifications',
      href: '/notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    { label: 'Explore & Trends', href: '/explore', icon: Compass },
    {
      label: 'Messages',
      href: '/messages',
      icon: MessageCircle,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    { label: 'Live Stream', href: '/live', icon: Radio, highlight: true },
    { label: 'Saved Moments', href: '/saved', icon: Bookmark },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 hidden lg:flex flex-col justify-between sticky top-20 h-[calc(100vh-6.5rem)] pb-2 select-none">
      {/* Top Section: Navigation Links */}
      <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-2.5 shadow-xl flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all group relative overflow-hidden',
                isActive
                  ? 'bg-gradient-to-r from-rose-500/20 via-pink-500/15 to-indigo-500/20 text-rose-200 border border-rose-500/30 shadow-sm shadow-rose-500/10 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.05]',
                item.highlight && !isActive && 'text-rose-400 hover:bg-rose-500/10'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-rose-500 to-indigo-500 rounded-r-full" />
              )}
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-hover:scale-110',
                    isActive ? 'text-rose-400' : 'text-slate-400 group-hover:text-white',
                    item.highlight && 'text-rose-400'
                  )}
                />
                <span className="tracking-tight">{item.label}</span>
              </div>

              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full shadow-sm shadow-rose-500/30 animate-pulse">
                  {item.badge}
                </span>
              )}

              {item.highlight && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom Section: User Profile */}
      {currentUser && (
        <div className="pt-2">
          <Link
            href={`/profile/${currentUser.username}`}
            className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.15] rounded-2xl p-2.5 shadow-lg flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <UserAvatar
                  avatarUrl={currentUser.avatarUrl}
                  name={currentUser.displayName}
                  username={currentUser.username}
                  size="sm"
                  className="ring-2 ring-white/10 group-hover:ring-indigo-500/50 transition-all"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-xs truncate group-hover:text-rose-300 transition-colors">
                  {currentUser.displayName}
                </p>
                <p className="text-[10px] text-slate-400 truncate">@{currentUser.username}</p>
              </div>
            </div>
            <User className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors flex-shrink-0" />
          </Link>
        </div>
      )}
    </aside>
  );
};
