'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';
import { useStore } from '../store/useStore';

interface ReactionUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified?: boolean;
}

interface ReactionEntry {
  id: string;
  userId: string;
  postId: string;
  type: string;
  createdAt: string;
  user: ReactionUser;
}

interface ReactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

const REACTION_META: Record<string, { label: string; emoji: string; color: string }> = {
  LIKE: { label: 'Like', emoji: '👍', color: 'text-blue-400' },
  LOVE: { label: 'Love', emoji: '❤️', color: 'text-rose-500' },
  CARE: { label: 'Care', emoji: '🥰', color: 'text-amber-400' },
  HAHA: { label: 'Haha', emoji: '😆', color: 'text-amber-400' },
  WOW: { label: 'Wow', emoji: '😮', color: 'text-amber-400' },
  SAD: { label: 'Sad', emoji: '😢', color: 'text-amber-400' },
  ANGRY: { label: 'Angry', emoji: '😡', color: 'text-orange-500' },
};

export const ReactionsModal: React.FC<ReactionsModalProps> = ({ isOpen, onClose, postId }) => {
  const { currentUser } = useStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reactions, setReactions] = useState<ReactionEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !postId) return;

    let isMounted = true;
    setLoading(true);
    setActiveTab('ALL');

    api
      .get(`/posts/${postId}/reactions`)
      .then((res) => {
        if (isMounted) {
          const list = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
            ? res.data.data
            : [];
          setReactions(list);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch reactions:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, postId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Compute counts per reaction type
  const countsByType: Record<string, number> = {};
  reactions.forEach((r) => {
    const t = r.type || 'LIKE';
    countsByType[t] = (countsByType[t] || 0) + 1;
  });

  const availableTypes = Object.keys(countsByType);

  const filteredReactions =
    activeTab === 'ALL'
      ? reactions
      : reactions.filter((r) => (r.type || 'LIKE') === activeTab);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#131926] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h3 className="text-base font-semibold text-white">People who reacted</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reaction Filter Tabs (Facebook style) */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.08] overflow-x-auto scrollbar-none bg-[#111722]/60">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <span>All</span>
            <span className="text-[11px] opacity-80">{reactions.length}</span>
          </button>

          {availableTypes.map((type) => {
            const meta = REACTION_META[type] || { emoji: '👍', label: type };
            const count = countsByType[type];
            const isActive = activeTab === type;

            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white/15 text-white ring-1 ring-white/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span className="text-sm">{meta.emoji}</span>
                <span className="text-[11px]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content - User List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-white/[0.04]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-xs">Loading reactions...</span>
            </div>
          ) : filteredReactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No reactions in this category.
            </div>
          ) : (
            filteredReactions.map((item) => {
              const u = item.user;
              const meta = REACTION_META[item.type] || { emoji: '👍', label: 'Like' };
              const isMe = currentUser?.id === u?.id || currentUser?.username === u?.username;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <Link
                    href={`/profile/${u?.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 group min-w-0 flex-1 mr-2"
                  >
                    {/* Avatar with Emoji Reaction Badge */}
                    <div className="relative shrink-0">
                      <UserAvatar
                        avatarUrl={u?.avatarUrl}
                        name={u?.displayName}
                        username={u?.username}
                        size="md"
                      />
                      <span
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#182032] border border-white/20 flex items-center justify-center text-[11px] shadow-sm select-none"
                        title={meta.label}
                      >
                        {meta.emoji}
                      </span>
                    </div>

                    {/* Names */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                          {u?.displayName || u?.username || 'User'}
                        </span>
                        {u?.isVerified && (
                          <CheckCircle className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20 shrink-0" />
                        )}
                        {isMe && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">@{u?.username}</p>
                    </div>
                  </Link>

                  {/* Profile action link */}
                  <Link
                    href={`/profile/${u?.username}`}
                    onClick={onClose}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 transition-colors"
                  >
                    View
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
