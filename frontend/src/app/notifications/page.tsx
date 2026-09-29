'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  Heart,
  MessageSquare,
  Radio,
  Camera,
  FileText,
  UserPlus,
  UserCheck,
  Trash2,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { UserAvatar } from '../../components/UserAvatar';
import { api } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { formatTimeAgo } from '../../lib/utils';
import { getSocket } from '../../lib/socket';

interface NotificationItem {
  id: string;
  recipientId: string;
  senderId: string;
  type: string;
  entityId: string | null;
  entityType: string | null;
  message: string;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { currentUser, setUnreadNotificationsCount } = useStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');

  useEffect(() => {
    loadNotifications();

    const socket = getSocket();
    const handleNewNotif = (notif: NotificationItem) => {
      setNotifications((prev) => [notif, ...prev]);
      const current = useStore.getState().unreadNotificationsCount || 0;
      setUnreadNotificationsCount(current + 1);
    };

    socket.on('notification:new', handleNewNotif);
    return () => {
      socket.off('notification:new', handleNewNotif);
    };
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
        if (typeof res.unreadCount === 'number') {
          setUnreadNotificationsCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      const current = useStore.getState().unreadNotificationsCount || 1;
      setUnreadNotificationsCount(Math.max(0, current - 1));
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotificationsCount(0);
    } catch {}
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const handleClickNotification = (n: NotificationItem) => {
    if (!n.isRead) {
      handleMarkAsRead(n.id);
    }

    if (n.type === 'LIVE') {
      router.push(`/live${n.entityId ? `?id=${n.entityId}` : ''}`);
    } else if (n.type === 'POST' || n.type === 'REACT' || n.type === 'COMMENT') {
      if (n.entityId) router.push(`/?post=${n.entityId}`);
      else router.push('/');
    } else if (n.type === 'STORY') {
      router.push('/');
    } else if (n.type === 'FRIEND_REQUEST' || n.type === 'FRIEND_ACCEPT') {
      if (n.sender?.username) router.push(`/profile/${n.sender.username}`);
      else router.push('/friends');
    } else if (n.sender?.username) {
      router.push(`/profile/${n.sender.username}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'REACT':
      case 'LIKE':
        return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />;
      case 'COMMENT':
        return <MessageSquare className="w-3.5 h-3.5 text-blue-400 fill-blue-400/30" />;
      case 'LIVE':
        return <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />;
      case 'STORY':
        return <Camera className="w-3.5 h-3.5 text-amber-400" />;
      case 'POST':
        return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
      case 'FRIEND_REQUEST':
        return <UserPlus className="w-3.5 h-3.5 text-indigo-400" />;
      case 'FRIEND_ACCEPT':
        return <UserCheck className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-rose-400" />;
    }
  };

  const filteredNotifications =
    activeTab === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col selection:bg-rose-500/30 selection:text-rose-200">
      <Navbar />

      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 flex gap-6 py-4 sm:py-6 pb-24 lg:pb-8 flex-1">
        <Sidebar />

        <main className="flex-1 max-w-2xl mx-auto w-full">
          {/* Header Card */}
          <div className="bg-[#111726]/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-xl border border-white/[0.08] mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500/20 via-pink-500/20 to-indigo-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-950/40">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-black animate-pulse">
                        {unreadCount} new
                      </span>
                    )}
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time updates from your friends, posts, stories, and live broadcasts
                  </p>
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white text-xs font-semibold border border-white/[0.08] transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mark all as read</span>
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('UNREAD')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'UNREAD'
                    ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Notifications Feed */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              <span className="text-xs">Loading notifications...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-[#111726]/60 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/[0.06] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-slate-500 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {activeTab === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When friends react to your posts, comment, go live, or add stories, they will appear here!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`relative p-4 rounded-2xl border transition-all cursor-pointer group flex items-start gap-3.5 ${
                    !n.isRead
                      ? 'bg-[#111726] border-rose-500/30 hover:border-rose-500/50 shadow-lg shadow-rose-950/20'
                      : 'bg-[#111726]/60 border-white/[0.06] hover:border-white/[0.12] hover:bg-[#111726]/90'
                  }`}
                >
                  {/* Sender Avatar with Notification Badge */}
                  <div className="relative shrink-0">
                    <UserAvatar
                      avatarUrl={n.sender?.avatarUrl}
                      name={n.sender?.displayName || 'User'}
                      size="md"
                    />
                    <span className="absolute -bottom-1 -right-1 p-1 bg-[#111726] rounded-full border border-white/10 shadow-sm">
                      {getNotificationIcon(n.type)}
                    </span>
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <p className={`text-xs leading-relaxed ${!n.isRead ? 'text-white font-semibold' : 'text-slate-300'}`}>
                      {n.message}
                    </p>
                    <span className="text-[10px] text-slate-500 mt-1 block font-medium">
                      {formatTimeAgo(n.createdAt)}
                    </span>
                  </div>

                  {/* Actions & Unread Indicator */}
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    {!n.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse mr-1" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(n.id, e)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
