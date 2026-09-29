'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  MessageCircle,
  Radio,
  Plus,
  Home,
  User,
  LogOut,
  Sparkles,
  LogIn,
  Heart,
  Compass,
  Video,
  Users,
  Bell,
  Loader2,
  ArrowRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';

interface NavbarProps {
  onOpenCreatePost?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreatePost }) => {
  const router = useRouter();
  const {
    currentUser,
    setCurrentUser,
    unreadMessagesCount,
    unreadNotificationsCount,
    onlineUsers,
    isMuted,
    toggleMute,
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);

  // Live Search States
  const [searchResults, setSearchResults] = useState<{ users: any[]; posts: any[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    api
      .get('/friends/requests')
      .then((res) => {
        if (res.success && res.data) {
          setFriendRequestsCount(res.data.length);
        }
      })
      .catch(() => {});
  }, [currentUser]);

  // Debounced search for instant user autocomplete
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        if (res.success && res.data) {
          setSearchResults(res.data);
        }
      } catch (err) {
        console.error('Navbar search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearchDropdown(false);
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSelectUser = (username: string) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    router.push(`/profile/${username}`);
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('nuraiyan_token');
    setCurrentUser(null);
    setShowProfileMenu(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B0F19]/80 backdrop-blur-2xl border-b border-white/[0.08] transition-all shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group focus:outline-none">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-rose-500/25 border border-white/20 group-hover:scale-105 group-hover:shadow-rose-500/40 transition-all">
                N
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-[#0B0F19] flex items-center justify-center">
                <Heart className="w-2 h-2 text-white fill-white" />
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-white tracking-tight leading-none flex items-center gap-1.5">
                Nuraiyan
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  PRO
                </span>
              </span>
              <span className="hidden sm:flex text-[10px] font-medium text-rose-400/90 tracking-wide mt-0.5 items-center gap-1">
                <span>Nusrat &amp; Raiyan</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Search Bar with Instant Autocomplete Dropdown */}
        <div ref={searchContainerRef} className="flex-1 max-w-md relative">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative flex items-center group">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none group-focus-within:text-rose-400 transition-colors" />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                placeholder="Search posts, topics, or people..."
                className="w-full bg-white/[0.05] hover:bg-white/[0.08] focus:bg-white/[0.1] text-xs sm:text-sm pl-10 pr-12 py-2.5 rounded-2xl border border-white/[0.08] focus:border-rose-500/50 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all text-slate-100 placeholder-slate-400 shadow-inner"
              />
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-rose-400 animate-spin absolute right-3" />
              ) : (
                <div className="absolute right-3 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.1] text-[10px] text-slate-400 font-mono pointer-events-none">
                  <span>⌘</span>K
                </div>
              )}
            </div>
          </form>

          {/* Autocomplete Dropdown Menu */}
          {showSearchDropdown && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-[#111726]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.12] py-2 z-50 animate-in fade-in zoom-in-95 max-h-96 overflow-y-auto scrollbar-thin">
              {/* People Section */}
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>People &amp; Friends</span>
                {searchResults?.users && (
                  <span className="text-rose-400 font-semibold">{searchResults.users.length} found</span>
                )}
              </div>

              {searchResults?.users && searchResults.users.length > 0 ? (
                <div className="divide-y divide-white/[0.04]">
                  {searchResults.users.map((user: any) => {
                    const isOnline = onlineUsers.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user.username)}
                        className="flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.08] cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <UserAvatar
                              avatarUrl={user.avatarUrl}
                              name={user.displayName}
                              username={user.username}
                              size="sm"
                            />
                            {isOnline && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                              {user.displayName}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">@{user.username}</p>
                          </div>
                        </div>

                        <span className="text-[11px] text-rose-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                          <span>View</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : !isSearching ? (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-slate-400">No users found for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : null}

              {/* View all in explore */}
              <div className="mt-1 pt-1.5 border-t border-white/[0.08] px-2">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-rose-400 hover:text-white hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>See all results for &ldquo;{searchQuery}&rdquo;</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={onOpenCreatePost}
            className="hidden sm:flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-rose-500 via-rose-600 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-500/20 border border-white/20 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden md:inline">New Post</span>
          </button>

          <Link
            href="/friends"
            className="hidden md:flex p-2.5 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-xl relative transition-all"
            title="Friends & Requests"
          >
            <Users className="w-5 h-5" />
            {friendRequestsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#0B0F19] animate-pulse">
                {friendRequestsCount}
              </span>
            )}
          </Link>

          <Link
            href="/notifications"
            className="hidden md:flex p-2.5 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-xl relative transition-all"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#0B0F19] animate-pulse">
                {unreadNotificationsCount}
              </span>
            )}
          </Link>

          <Link
            href="/messages"
            className="hidden md:flex p-2.5 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-xl relative transition-all"
            title="Messages"
          >
            <MessageCircle className="w-5 h-5" />
            {unreadMessagesCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#0B0F19] animate-pulse">
                {unreadMessagesCount}
              </span>
            )}
          </Link>

          <Link
            href="/live"
            className="hidden lg:flex p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all items-center gap-1.5 relative group"
            title="Live Stream"
          >
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="hidden xl:inline text-xs font-bold text-rose-400">Live</span>
          </Link>

          {/* Global Sound Mute/Unmute Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className={`p-2.5 rounded-xl transition-all cursor-pointer border flex items-center justify-center ${
              isMuted
                ? 'text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
                : 'text-rose-400 hover:text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 shadow-sm shadow-rose-500/10'
            }`}
            title={isMuted ? 'Sound is Muted (Click to turn sound ON)' : 'Sound is Active (Click to MUTE)'}
            aria-label={isMuted ? 'Turn sound on' : 'Mute sound'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-slate-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-rose-400 animate-pulse" />
            )}
          </button>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative ml-1">
            {currentUser ? (
              <>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 focus:outline-none p-0.5 rounded-full hover:ring-2 hover:ring-rose-500/50 transition-all cursor-pointer"
                >
                  <div className="relative shrink-0">
                    <UserAvatar
                      avatarUrl={currentUser.avatarUrl}
                      name={currentUser.displayName}
                      username={currentUser.username}
                      size="sm"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#0B0F19]" />
                  </div>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-3 w-64 bg-[#111726]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.1] py-2.5 z-50 animate-in fade-in zoom-in-95 text-slate-200">
                    <div className="px-4 py-3 border-b border-white/[0.08]">
                      <p className="font-bold text-white text-sm truncate">
                        {currentUser.displayName}
                      </p>
                      <p className="text-xs text-rose-300/80 truncate">@{currentUser.username}</p>
                    </div>

                    <Link
                      href={`/profile/${currentUser.username}`}
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>View Profile</span>
                    </Link>

                    <Link
                      href="/friends"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                    >
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>Friends</span>
                    </Link>

                    <Link
                      href="/saved"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Saved Moments</span>
                    </Link>

                    <div className="my-1 border-t border-white/[0.08]" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link
                href="/auth/login"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-500 to-indigo-600 text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-rose-500/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
