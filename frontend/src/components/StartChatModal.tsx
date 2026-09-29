'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, MessageCircle, MessageSquarePlus, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { UserAvatar } from './UserAvatar';
import { formatLastActive } from '../lib/utils';

interface FriendUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  lastSeenAt?: string | null;
}

interface StartChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: FriendUser) => void;
}

export const StartChatModal: React.FC<StartChatModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
}) => {
  const { currentUser, onlineUsers, userLastSeen } = useStore();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      // 1. Fetch confirmed friends list
      const res = await api.get('/friends/list');
      let friendList: FriendUser[] = [];

      if (res.success && Array.isArray(res.data)) {
        friendList = res.data.map((f: any) => ({
          id: f.id,
          username: f.username,
          displayName: f.displayName,
          avatarUrl: f.avatarUrl,
          lastSeenAt: f.lastSeenAt,
        }));
      }

      // If no friends found, also pull suggestions so user can start chatting with anyone
      if (friendList.length === 0) {
        const suggRes = await api.get('/users/suggestions');
        if (suggRes.success && Array.isArray(suggRes.data)) {
          friendList = suggRes.data.filter((u: any) => u.id !== currentUser?.id);
        }
      }

      setFriends(friendList);
    } catch (err) {
      console.error('Failed to load friends for chat:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filtered = friends.filter(
    (f) =>
      f.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#111726] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Start a Conversation</h3>
              <p className="text-[11px] text-slate-400">Select a friend to begin messaging</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-white/[0.06] bg-white/[0.01]">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends by name or username..."
              className="w-full bg-white/[0.05] text-xs pl-10 pr-4 py-2.5 rounded-xl border border-white/[0.08] text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 min-h-[220px]">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading friends...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-slate-500" />
              <span>{searchQuery ? 'No matching friends found' : 'No friends available yet'}</span>
            </div>
          ) : (
            filtered.map((friend) => {
              const isOnline = onlineUsers.includes(friend.id);
              const lastActive = userLastSeen[friend.id] || friend.lastSeenAt;

              return (
                <div
                  key={friend.id}
                  onClick={() => {
                    onSelectUser(friend);
                    onClose();
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.06] cursor-pointer transition-all border border-transparent hover:border-white/[0.08] group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <UserAvatar
                        avatarUrl={friend.avatarUrl}
                        name={friend.displayName}
                        username={friend.username}
                        size="md"
                      />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                        {friend.displayName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-slate-400 truncate">@{friend.username}</span>
                        <span className="text-[10px] text-slate-600">•</span>
                        {isOnline ? (
                          <span className="text-[10px] font-semibold text-emerald-400">Active now</span>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            {formatLastActive(lastActive)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/15 group-hover:bg-rose-500 group-hover:text-white text-rose-300 text-xs font-bold rounded-xl transition-all border border-rose-500/30 shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
