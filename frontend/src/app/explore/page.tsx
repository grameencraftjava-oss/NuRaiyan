'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { UserAvatar } from '../../components/UserAvatar';
import {
  Search,
  TrendingUp,
  Heart,
  MessageCircle,
  Play,
  Compass,
  Users,
  UserPlus,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { api, resolveMediaUrl } from '../../lib/api';
import { isVideoUrl } from '../../lib/utils';
import { useStore } from '../../store/useStore';

function ExploreContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const { currentUser, onlineUsers } = useStore();

  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [matchedUsers, setMatchedUsers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestedUserIds, setRequestedUserIds] = useState<Set<string>>(new Set());
  const [requestLoadingId, setRequestLoadingId] = useState<string | null>(null);

  const categories = [
    { id: 'ALL', label: 'All' },
    { id: 'TRENDING', label: '🔥 Trending' },
    { id: 'TECH', label: '💻 Technology' },
    { id: 'TRAVEL', label: '✈️ Travel & Nature' },
    { id: 'FOOD', label: '🍔 Food & Cuisine' },
    { id: 'FITNESS', label: '💪 Fitness' },
  ];

  // Update searchQuery when URL query param changes
  useEffect(() => {
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
  }, [urlQuery]);

  useEffect(() => {
    loadExploreContent();
  }, [searchQuery, activeCategory]);

  const loadExploreContent = async () => {
    setLoading(true);
    try {
      const q = searchQuery.trim();
      if (q) {
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        if (res.success && res.data) {
          setMatchedUsers(res.data.users || []);
          setItems(res.data.posts || []);
        }
      } else {
        setMatchedUsers([]);
        const res = await api.get('/posts/feed?limit=20');
        if (res.success && Array.isArray(res.data)) {
          setItems(res.data);
        }
      }
    } catch (err) {
      console.error('Failed to load explore:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    setRequestLoadingId(targetUserId);
    try {
      const res = await api.post(`/friends/request/${targetUserId}`);
      if (res.success) {
        setRequestedUserIds((prev) => new Set([...prev, targetUserId]));
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
    } finally {
      setRequestLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col selection:bg-rose-500/30 selection:text-rose-200">
      <Navbar />

      <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 flex gap-6 py-4 sm:py-6 pb-24 lg:pb-8 flex-1">
        <Sidebar />

        <main className="flex-1 max-w-4xl mx-auto w-full space-y-6">
          {/* Header & Search Bar */}
          <div className="bg-[#111726]/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/[0.08]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h1 className="font-extrabold text-xl text-white flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span>Explore &amp; Discover</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Discover trending conversations, ideas, people, and vibrant media across Nuraiyan
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, @username, or post..."
                  className="w-full bg-white/[0.04] text-xs pl-10 pr-3.5 py-2.5 rounded-xl text-slate-100 placeholder-slate-500 border border-white/[0.08] focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/30 transition-all"
                />
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0 cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-lg shadow-rose-500/25 border border-white/20'
                      : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] border border-white/[0.06]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Result: People & Profiles Section */}
          {searchQuery.trim().length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-400" />
                  <span>People &amp; Profiles</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold lowercase">
                    {matchedUsers.length} found
                  </span>
                </h2>
              </div>

              {matchedUsers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {matchedUsers.map((user) => {
                    const isOnline = onlineUsers.includes(user.id);
                    const isMe = currentUser?.id === user.id;
                    const hasRequested = requestedUserIds.has(user.id);
                    const isProcessing = requestLoadingId === user.id;

                    return (
                      <div
                        key={user.id}
                        className="bg-[#111726]/90 border border-white/[0.08] hover:border-white/20 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <Link href={`/profile/${user.username}`} className="relative shrink-0">
                            <UserAvatar
                              avatarUrl={user.avatarUrl}
                              name={user.displayName}
                              username={user.username}
                              size="md"
                            />
                            {isOnline && (
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                            )}
                          </Link>

                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/profile/${user.username}`}
                              className="font-bold text-sm text-white hover:text-rose-400 transition-colors truncate block"
                            >
                              {user.displayName}
                            </Link>
                            <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                            {user.bio && (
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                                {user.bio}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                          <Link
                            href={`/profile/${user.username}`}
                            className="flex-1 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <span>Profile</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>

                          {!isMe && (
                            hasRequested ? (
                              <button
                                disabled
                                className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-default"
                              >
                                <Check className="w-3 h-3" />
                                <span>Sent</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendFriendRequest(user.id)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3 h-3" />
                                )}
                                <span>Add</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                !loading && (
                  <div className="bg-[#111726]/60 rounded-2xl p-6 text-center border border-white/[0.06]">
                    <p className="text-xs text-slate-400">
                      No user accounts found matching &ldquo;{searchQuery}&rdquo;
                    </p>
                  </div>
                )
              )}
            </div>
          )}

          {/* Section: Posts / Feed Grid */}
          <div className="space-y-3">
            {searchQuery.trim().length > 0 && (
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-400" />
                <span>Posts &amp; Media</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold lowercase">
                  {items.length} posts
                </span>
              </h2>
            )}

            {/* Loading Skeleton */}
            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="aspect-square bg-[#111726]/80 border border-white/[0.06] rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && items.length === 0 && matchedUsers.length === 0 && (
              <div className="bg-[#111726]/80 backdrop-blur-xl rounded-3xl p-12 border border-white/[0.08] text-center shadow-xl">
                <Compass className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="font-bold text-white text-base mb-1">No content found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery
                    ? `No users or posts found matching "${searchQuery}". Try searching for another name or keyword.`
                    : 'Public posts and trending moments will appear here automatically as they are published.'}
                </p>
              </div>
            )}

            {/* Real Media Bento Grid */}
            {!loading && items.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {items.map((post) => {
                  const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
                  const mediaUrl = hasMedia ? post.mediaUrls[0] : null;
                  const isVideo = post.mediaType === 'VIDEO' || isVideoUrl(mediaUrl);

                  return (
                    <div
                      key={post.id}
                      className="relative group rounded-2xl overflow-hidden aspect-square cursor-pointer shadow-lg bg-[#111726]/80 border border-white/[0.08] hover:border-rose-500/40 transition-all flex items-center justify-center"
                    >
                      {mediaUrl ? (
                        isVideo ? (
                          <video
                            src={resolveMediaUrl(mediaUrl)}
                            muted
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={resolveMediaUrl(mediaUrl)}
                            alt="Post media"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-xs text-slate-300 line-clamp-4 leading-relaxed">
                            {post.content}
                          </p>
                        </div>
                      )}

                      {isVideo && (
                        <div className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white border border-white/20">
                          <Play className="w-3.5 h-3.5 fill-white" />
                        </div>
                      )}

                      {/* Dark Overlay on Hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold text-sm backdrop-blur-[2px]">
                        <div className="flex items-center gap-1.5">
                          <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                          <span>{post._count?.likes || post.likesCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="w-5 h-5 fill-indigo-400 text-indigo-400" />
                          <span>{post._count?.comments || post.commentsCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070A12] flex flex-col items-center justify-center p-6 text-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-2xl shadow-rose-950/50">
            N
          </div>
          <p className="mt-4 text-xs font-semibold text-rose-300/80 tracking-widest uppercase animate-pulse">
            Loading Explore...
          </p>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
