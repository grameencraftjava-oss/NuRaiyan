'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  MessageCircle,
  Search,
  Check,
  X,
  Loader2,
  Sparkles,
  Phone,
  Video,
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { UserAvatar } from '../../components/UserAvatar';
import { api } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { formatLastActive } from '../../lib/utils';

interface FriendUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  isVerified?: boolean;
  location?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}


interface FriendRequestItem {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  createdAt: string;
  sender: FriendUser;
}

export default function FriendsPage() {
  const router = useRouter();
  const { currentUser, setActiveCall, onlineUsers, userLastSeen } = useStore();
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'SUGGESTIONS' | 'ALL' | 'ACTIVE'>('REQUESTS');

  // Real-time ticker to update relative last seen times live every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Lists
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [suggestions, setSuggestions] = useState<FriendUser[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Sent requests tracker in suggestions tab
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [reqRes, sugRes, friRes] = await Promise.all([
        api.get('/friends/requests'),
        api.get('/friends/suggestions'),
        api.get('/friends/list'),
      ]);

      let hasReq = false;
      let hasFri = false;
      if (reqRes.success && reqRes.data) {
        setRequests(reqRes.data);
        hasReq = reqRes.data.length > 0;
      }
      if (sugRes.success && sugRes.data) {
        setSuggestions(sugRes.data);
      }
      if (friRes.success && friRes.data) {
        setFriends(friRes.data);
        hasFri = friRes.data.length > 0;
      }

      // If no incoming requests, intelligently open All Friends or Suggestions so page is never empty
      if (!hasReq) {
        if (hasFri) {
          setActiveTab('ALL');
        } else {
          setActiveTab('SUGGESTIONS');
        }
      }
    } catch (err) {
      console.error('Failed to load friends data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ────────────────────────────────────────────────
  const handleConfirmRequest = async (senderId: string) => {
    setActionLoadingId(senderId);
    try {
      const res = await api.post(`/friends/accept/${senderId}`);
      if (res.success) {
        // Move sender from requests to friends list
        const accepted = requests.find((r) => r.senderId === senderId);
        if (accepted && accepted.sender) {
          setFriends((prev) => [accepted.sender, ...prev]);
        }
        setRequests((prev) => prev.filter((r) => r.senderId !== senderId));
      }
    } catch (err) {
      console.error('Error confirming friend request:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteRequest = async (senderId: string) => {
    setActionLoadingId(senderId);
    try {
      const res = await api.post(`/friends/reject/${senderId}`);
      if (res.success) {
        setRequests((prev) => prev.filter((r) => r.senderId !== senderId));
      }
    } catch (err) {
      console.error('Error deleting friend request:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    setActionLoadingId(targetUserId);
    try {
      const res = await api.post(`/friends/request/${targetUserId}`);
      if (res.success) {
        setSentRequestIds((prev) => new Set([...prev, targetUserId]));
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveSuggestion = (userId: string) => {
    setSuggestions((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleUnfriend = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from your friends?`)) return;
    setActionLoadingId(userId);
    try {
      const res = await api.delete(`/friends/unfriend/${userId}`);
      if (res.success) {
        setFriends((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (err) {
      console.error('Error unfriending user:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Direct Audio / Video Call (Only Allowed for Friends!)
  const handleStartCall = (friend: FriendUser, type: 'AUDIO' | 'VIDEO') => {
    setActiveCall({
      callId: `call_${Date.now()}`,
      otherUser: {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl || null,
      },
      type,
      isIncoming: false,
      status: 'RINGING',
    });
  };

  // Filter Active Friends based on real-time connected socket presence
  const activeFriends = friends.filter((f) => onlineUsers.includes(f.id));
  const currentFriendsList = activeTab === 'ACTIVE' ? activeFriends : friends;

  // Filter Friends by search input
  const filteredFriends = currentFriendsList.filter(
    (f) =>
      f.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.username.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8 flex gap-6 flex-1 w-full">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Center Main Content Area */}
        <div className="flex-1 max-w-4xl space-y-6">
          {/* Header Banner */}
          <div className="bg-[#111726]/80 backdrop-blur-xl rounded-3xl p-6 border border-white/[0.08] shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 text-blue-400 mb-1">
                <Users className="w-6 h-6" />
                <h1 className="text-2xl font-extrabold text-white">Friends</h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Connect with people, manage friend requests, and discover suggestions.
              </p>
            </div>

            {/* Facebook-Style Navigation Tabs */}
            <div className="flex items-center gap-1.5 bg-[#0D121F] p-1.5 rounded-2xl border border-white/[0.06] overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('REQUESTS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'REQUESTS'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>Requests</span>
                {requests.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-extrabold animate-pulse">
                    {requests.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ACTIVE')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'ACTIVE'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Active Now</span>
                <span className="text-[11px] opacity-75">{activeFriends.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>All Friends</span>
                <span className="text-[11px] opacity-75">{friends.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SUGGESTIONS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'SUGGESTIONS'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>Suggestions</span>
                <span className="text-[11px] opacity-75">{suggestions.length}</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Friend Requests */}
          {activeTab === 'REQUESTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <span>Friend Requests</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                    {requests.length}
                  </span>
                </h2>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                  <span className="text-xs">Loading friend requests...</span>
                </div>
              ) : requests.length === 0 ? (
                <div className="bg-[#111726]/60 rounded-3xl p-12 text-center border border-white/[0.06] space-y-3">
                  <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                    <UserCheck className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-white text-base">No pending friend requests</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    When people send you friend requests, they will appear here. Explore suggestions to connect with friends!
                  </p>
                  <button
                    onClick={() => setActiveTab('SUGGESTIONS')}
                    className="mt-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    View Friend Suggestions
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {requests.map((req) => {
                    const u = req.sender;
                    const isProcessing = actionLoadingId === u.id;

                    return (
                      <div
                        key={req.id}
                        className="bg-[#111726]/90 border border-white/[0.08] hover:border-white/20 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all group"
                      >
                        <div className="flex flex-col items-center text-center space-y-3">
                          <Link href={`/profile/${u.username}`} className="relative group/avatar">
                            <UserAvatar
                              avatarUrl={u.avatarUrl}
                              name={u.displayName}
                              username={u.username}
                              size="xl"
                              className="ring-2 ring-white/10 group-hover/avatar:ring-blue-500 transition-all"
                            />
                          </Link>

                          <div>
                            <Link
                              href={`/profile/${u.username}`}
                              className="font-bold text-sm text-white hover:text-blue-400 transition-colors line-clamp-1"
                            >
                              {u.displayName}
                            </Link>
                            <p className="text-xs text-slate-400">@{u.username}</p>
                            {u.location && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{u.location}</p>
                            )}
                          </div>
                        </div>

                        {/* Confirm & Delete Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleConfirmRequest(u.id)}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Confirm</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleDeleteRequest(u.id)}
                            className="w-full py-2 bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Friend Suggestions */}
          {activeTab === 'SUGGESTIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>People You May Know</span>
                </h2>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                  <span className="text-xs">Finding suggestions...</span>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="bg-[#111726]/60 rounded-3xl p-12 text-center border border-white/[0.06] space-y-2">
                  <p className="text-sm font-semibold text-white">No suggestions right now</p>
                  <p className="text-xs text-slate-400">Check back later or search for users by name.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {suggestions.map((u) => {
                    const isProcessing = actionLoadingId === u.id;
                    const hasSent = sentRequestIds.has(u.id);

                    return (
                      <div
                        key={u.id}
                        className="bg-[#111726]/90 border border-white/[0.08] hover:border-white/20 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all group"
                      >
                        <div className="flex flex-col items-center text-center space-y-3">
                          <Link href={`/profile/${u.username}`} className="relative group/avatar">
                            <UserAvatar
                              avatarUrl={u.avatarUrl}
                              name={u.displayName}
                              username={u.username}
                              size="xl"
                              className="ring-2 ring-white/10 group-hover/avatar:ring-blue-500 transition-all"
                            />
                          </Link>

                          <div>
                            <Link
                              href={`/profile/${u.username}`}
                              className="font-bold text-sm text-white hover:text-blue-400 transition-colors line-clamp-1"
                            >
                              {u.displayName}
                            </Link>
                            <p className="text-xs text-slate-400">@{u.username}</p>
                            {u.bio && (
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 px-1">
                                {u.bio}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Add Friend & Remove Buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                          {hasSent ? (
                            <button
                              type="button"
                              disabled
                              className="col-span-2 py-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-default"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Request Sent ✓</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleSendRequest(u.id)}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3.5 h-3.5" />
                                )}
                                <span>Add Friend</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveSuggestion(u.id)}
                                className="w-full py-2 bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <span>Remove</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: All Friends & Active Friends */}
          {(activeTab === 'ALL' || activeTab === 'ACTIVE') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <span>{activeTab === 'ACTIVE' ? 'Active Friends' : 'All Friends'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                    {filteredFriends.length}
                  </span>
                </h2>

                {/* Filter Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search friends..."
                    className="bg-[#111726] text-xs pl-8 pr-3 py-1.5 rounded-xl border border-white/[0.08] focus:border-blue-500 focus:outline-none text-slate-200 placeholder-slate-500 w-48 sm:w-60"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                  <span className="text-xs">Loading friends...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="bg-[#111726]/60 rounded-3xl p-12 text-center border border-white/[0.06] space-y-2">
                  <p className="text-sm font-semibold text-white">
                    {searchFilter
                      ? 'No friends match your search'
                      : activeTab === 'ACTIVE'
                      ? 'No friends are active right now'
                      : 'No friends yet'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {activeTab === 'ACTIVE'
                      ? 'Friends who come online will automatically show up here in real time.'
                      : 'Find and add friends to message, audio/video call, and share posts with them!'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredFriends.map((u) => {
                    const isProcessing = actionLoadingId === u.id;
                    const isOnline = onlineUsers.includes(u.id);
                    const lastSeen = userLastSeen[u.id] || u.lastSeenAt;

                    return (
                      <div
                        key={u.id}
                        className="bg-[#111726]/90 border border-white/[0.08] hover:border-white/20 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all group relative"
                      >
                        {/* Top: Avatar, Name & Online Status */}
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <Link href={`/profile/${u.username}`} className="relative shrink-0">
                                <UserAvatar
                                  avatarUrl={u.avatarUrl}
                                  name={u.displayName}
                                  username={u.username}
                                  size="lg"
                                  className={isOnline ? 'ring-2 ring-emerald-500/50' : 'ring-2 ring-white/10'}
                                />
                                {isOnline && (
                                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                                )}
                              </Link>

                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/profile/${u.username}`}
                                  className="font-bold text-sm text-white hover:text-blue-400 transition-colors truncate block"
                                >
                                  {u.displayName}
                                </Link>
                                <p className="text-xs text-slate-400 truncate">@{u.username}</p>

                                {/* Active Status Indicator */}
                                {isOnline ? (
                                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-400">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span>Active now</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                    <span>{formatLastActive(lastSeen)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Unfriend Menu Button */}
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleUnfriend(u.id, u.displayName)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Unfriend"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Direct Call & Message Controls (Exclusively for Friends!) */}
                        <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
                          <Link
                            href={`/messages?user=${u.id}`}
                            className="py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors"
                            title={`Chat with ${u.displayName}`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleStartCall(u, 'AUDIO')}
                            className="py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="Start Audio Call"
                          >
                            <Phone className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Audio</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartCall(u, 'VIDEO')}
                            className="py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="Start HD Video Call"
                          >
                            <Video className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Video</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
