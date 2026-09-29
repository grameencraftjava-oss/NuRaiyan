'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../store/useStore';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';
import { Bell, X, Heart, MessageSquare, MessageCircle, Video, Radio, UserPlus, Sparkles } from 'lucide-react';

interface ToastNotif {
  id: string;
  sender?: {
    displayName?: string;
    username?: string;
    avatarUrl?: string | null;
  };
  type: string;
  message: string;
  link?: string;
}

import { playSystemNotification, playMessageChime } from '../lib/soundUtils';

export const GlobalNotificationListener: React.FC = () => {
  const router = useRouter();
  const {
    currentUser,
    setUnreadNotificationsCount,
    setUnreadMessagesCount,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
  } = useStore();

  const [activeToast, setActiveToast] = useState<ToastNotif | null>(null);

  // Sync initial unread notifications & messages count (and on tab focus)
  useEffect(() => {
    if (!currentUser) return;

    const syncUnreadCounts = () => {
      api
        .get('/notifications')
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            const unread = res.data.filter((n: any) => !n.isRead).length;
            setUnreadNotificationsCount(unread);
          }
        })
        .catch(() => {});

      api
        .get('/conversations/unread-count')
        .then((res) => {
          if (res.success && typeof res.count === 'number') {
            setUnreadMessagesCount(res.count);
          }
        })
        .catch(() => {});
    };

    syncUnreadCounts();

    window.addEventListener('focus', syncUnreadCounts);
    return () => {
      window.removeEventListener('focus', syncUnreadCounts);
    };
  }, [currentUser, setUnreadNotificationsCount, setUnreadMessagesCount]);

  // Socket presence and notification listener
  useEffect(() => {
    if (!currentUser) return;

    const socket = getSocket();
    if (!socket) return;

    const handleOnlineList = (userIds: string[]) => {
      if (Array.isArray(userIds)) {
        setOnlineUsers(userIds);
      }
    };

    const handleUserOnline = ({ userId }: { userId: string }) => {
      if (userId) {
        addOnlineUser(userId);
      }
    };

    const handleUserOffline = ({ userId, lastSeenAt }: { userId: string; lastSeenAt?: string }) => {
      if (userId) {
        removeOnlineUser(userId, lastSeenAt);
      }
    };

    const handleNewNotification = (notif: any) => {
      if (!notif) return;

      // Update counter in Zustand store
      setUnreadNotificationsCount((useStore.getState().unreadNotificationsCount || 0) + 1);

      // Play system chime
      playSystemNotification();

      // Show toast
      setActiveToast({
        id: notif.id || `notif_${Date.now()}`,
        sender: notif.sender,
        type: notif.type || 'NOTIFICATION',
        message: notif.message || 'You have a new notification',
        link: '/notifications',
      });
    };

    const handleIncomingChatMessage = (data: any) => {
      if (!data || !data.message) return;
      const msg = data.message;
      if (msg.senderId === currentUser?.id) return;

      // If user is currently inside /messages viewing this conversation, do not increment or show toast
      const isCurrentlyViewingChat =
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/messages') &&
        (window as any).__ACTIVE_CHAT_ID === msg.conversationId;

      if (!isCurrentlyViewingChat) {
        // Increment unread messages count in Zustand
        setUnreadMessagesCount((useStore.getState().unreadMessagesCount || 0) + 1);

        // Play loud message chime
        playMessageChime();

        // Show interactive chat toast
        setActiveToast({
          id: `chat_${msg.id || Date.now()}`,
          sender: msg.sender,
          type: 'MESSAGE',
          message: msg.content || (msg.mediaUrl ? '📷 Sent a media file' : 'Sent you a new message'),
          link: `/messages?user=${msg.senderId}`,
        });
      }
    };

    const handleUnreadUpdated = () => {
      api
        .get('/conversations/unread-count')
        .then((res) => {
          if (res.success && typeof res.count === 'number') {
            setUnreadMessagesCount(res.count);
          }
        })
        .catch(() => {});
    };

    // Periodic heartbeat every 45s while tab is active to refresh presence
    const heartbeatTimer = setInterval(() => {
      if (socket.connected && typeof document !== 'undefined' && !document.hidden) {
        socket.emit('user:heartbeat');
      }
    }, 45000);

    socket.on('users:online_list', handleOnlineList);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);
    socket.on('notification:new', handleNewNotification);
    socket.on('chat:incoming_notification', handleIncomingChatMessage);
    socket.on('chat:unread_updated', handleUnreadUpdated);
    socket.on('chat:messages_read', handleUnreadUpdated);

    return () => {
      clearInterval(heartbeatTimer);
      socket.off('users:online_list', handleOnlineList);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
      socket.off('notification:new', handleNewNotification);
      socket.off('chat:incoming_notification', handleIncomingChatMessage);
      socket.off('chat:unread_updated', handleUnreadUpdated);
      socket.off('chat:messages_read', handleUnreadUpdated);
    };
  }, [currentUser, setOnlineUsers, addOnlineUser, removeOnlineUser, setUnreadNotificationsCount, setUnreadMessagesCount]);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  if (!activeToast) return null;

  const renderIcon = (type: string) => {
    switch (type) {
      case 'REACT':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case 'COMMENT':
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case 'POST':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'LIVE':
        return <Radio className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'FRIEND_REQUEST':
      case 'FRIEND_ACCEPT':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      case 'MESSAGE':
        return <MessageCircle className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div
        onClick={() => {
          const destination = activeToast.link || '/notifications';
          setActiveToast(null);
          router.push(destination);
        }}
        className="bg-[#111726]/95 backdrop-blur-2xl border border-rose-500/30 hover:border-rose-500/60 shadow-2xl shadow-black/60 rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer group transition-all"
      >
        <div className="relative shrink-0 mt-0.5">
          <UserAvatar
            avatarUrl={activeToast.sender?.avatarUrl}
            name={activeToast.sender?.displayName || 'User'}
            username={activeToast.sender?.username || 'user'}
            size="md"
          />
          <span className="absolute -bottom-1 -right-1 p-1 bg-[#0B0F19] rounded-full border border-white/10 shadow-sm">
            {renderIcon(activeToast.type)}
          </span>
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
              {activeToast.type.replace('_', ' ')}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-medium">
            {activeToast.message}
          </p>
        </div>
      </div>
    </div>
  );
};
