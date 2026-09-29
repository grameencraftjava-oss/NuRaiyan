'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  Radio,
  MessageCircle,
  Bell,
  User,
  Users,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { UserAvatar } from './UserAvatar';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { currentUser, unreadMessagesCount, unreadNotificationsCount } = useStore();

  // Only show when user is logged in and not in full-screen call
  if (!currentUser) return null;

  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
    },
    {
      label: 'Explore',
      href: '/explore',
      icon: Compass,
    },
    {
      label: 'Live',
      href: '/live',
      icon: Radio,
      highlight: true,
    },
    {
      label: 'Messages',
      href: '/messages',
      icon: MessageCircle,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    {
      label: 'Alerts',
      href: '/notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    {
      label: 'Profile',
      href: `/profile/${currentUser.username}`,
      avatar: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#0a0e1a]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 pt-1 pb-safe shadow-[0_-8px_25px_rgba(0,0,0,0.5)] transition-all select-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto h-13">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 active:scale-90',
                isActive ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {/* Active glow pill */}
              {isActive && (
                <span className="absolute -top-1 w-6 h-1 bg-gradient-to-r from-rose-500 to-indigo-500 rounded-full shadow-sm shadow-rose-500/50" />
              )}

              <div className="relative">
                {item.avatar ? (
                  <div
                    className={cn(
                      'rounded-full transition-transform',
                      isActive && 'ring-2 ring-rose-500 ring-offset-1 ring-offset-[#0a0e1a]'
                    )}
                  >
                    <UserAvatar
                      avatarUrl={currentUser?.avatarUrl}
                      name={currentUser?.displayName}
                      username={currentUser?.username}
                      size="xs"
                    />
                  </div>
                ) : Icon ? (
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-transform',
                      isActive ? 'stroke-[2.5] text-rose-400 scale-110' : 'stroke-[1.8]',
                      item.highlight && !isActive && 'text-rose-400/90'
                    )}
                  />
                ) : null}

                {/* Badge for unread counts */}
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 min-w-4 text-[9px] font-black bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md shadow-rose-500/50 ring-2 ring-[#0a0e1a] animate-pulse">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}

                {/* Live ping dot */}
                {item.highlight && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </div>

              <span className={cn('text-[10px] mt-0.5 tracking-tight', isActive ? 'font-semibold text-rose-300' : 'text-slate-400 font-normal')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
