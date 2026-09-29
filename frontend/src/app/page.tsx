'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { StoriesBar } from '../components/StoriesBar';
import { PostCard } from '../components/PostCard';
import { CreatePostModal } from '../components/CreatePostModal';
import { VideoCallModal } from '../components/VideoCallModal';
import { AnimatedAuthCard } from '../components/AnimatedAuthCard';
import { AnimatedLoveLetter } from '../components/AnimatedLoveLetter';
import { AestheticCosmicBackground } from '../components/AestheticCosmicBackground';
import { UserAvatar } from '../components/UserAvatar';
import {
  Image as ImageIcon,
  Music,
  Phone,
  Video as VideoIcon,
  TrendingUp,
  Sparkles,
  MessageSquarePlus,
  RefreshCw,
  Heart,
  Globe,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle,
  Camera,
  Zap,
  Users,
  Star,
  Flame,
  Radio,
  MessageCircle,
  PlayCircle,
  Pencil,
  BookOpen,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { formatLastActive } from '../lib/utils';


export default function Home() {
  const {
    currentUser,
    setCurrentUser,
    fetchCurrentUser,
    activeCall,
    setActiveCall,
    isLoadingUser,
    onlineUsers,
    userLastSeen,
  } = useStore();

  // Landing Page State
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Login Form State
  const [loginData, setLoginData] = useState({ login: '', password: '' });

  // Register Form State
  const [registerData, setRegisterData] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
  });

  // Authenticated Feed State
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeLiveStreams, setActiveLiveStreams] = useState<any[]>([]);

  const [mounted, setMounted] = useState(false);

  // Real-time ticker to update relative active timestamps live every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Initial Load
  useEffect(() => {
    setMounted(true);
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Load Feed when logged in
  useEffect(() => {
    if (currentUser) {
      loadFeed();
      loadSuggestions();
      loadFriends();
      loadActiveLiveStreams();

      const socket = getSocket();
      const handleStreamStarted = (data: any) => {
        setActiveLiveStreams((prev) => {
          if (prev.some((s) => s.id === data.streamId)) return prev;
          return [data, ...prev];
        });
      };
      const handleStreamEnded = (data: { streamId?: string; hostId?: string }) => {
        setActiveLiveStreams((prev) =>
          prev.filter(
            (s) =>
              (!data.streamId || (s.id !== data.streamId && s.streamId !== data.streamId)) &&
              (!data.hostId || s.hostId !== data.hostId)
          )
        );
      };

      socket.on('live:stream_started_global', handleStreamStarted);
      socket.on('live:stream_ended_global', handleStreamEnded);

      return () => {
        socket.off('live:stream_started_global', handleStreamStarted);
        socket.off('live:stream_ended_global', handleStreamEnded);
      };
    }
  }, [currentUser]);

  const loadFriends = async () => {
    try {
      const res = await api.get('/friends/list');
      if (res.success && Array.isArray(res.data)) {
        setFriends(res.data);
      }
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  };

  const loadActiveLiveStreams = async () => {
    try {
      const res = await api.get('/live/streams');
      if (res.success && Array.isArray(res.data)) {
        setActiveLiveStreams(res.data);
      }
    } catch (err) {
      console.error('Failed to load active live streams:', err);
    }
  };

  const loadFeed = async () => {
    setLoadingPosts(true);
    try {
      const res = await api.get('/posts/feed');
      if (res.success && Array.isArray(res.data)) {
        setPosts(res.data);
      }
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      const res = await api.get('/users/suggestions');
      if (res.success && Array.isArray(res.data)) {
        setSuggestedUsers(res.data);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  // ── Auth Handlers ──────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const res = await api.post('/auth/login', loginData);

      if (res.success && res.data) {
        setAuthSuccess('Welcome! Sign in successful...');
        if (res.data.accessToken) {
          localStorage.setItem('nuraiyan_token', res.data.accessToken);
        }
        if (res.data.user) {
          setCurrentUser(res.data.user);
        } else {
          await fetchCurrentUser();
        }
      } else {
        setAuthError(res.message || 'Login failed. Please check credentials.');
      }
    } catch (err: any) {
      setAuthError('Could not reach server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const res = await api.post('/auth/register', registerData);

      if (res.success && res.data) {
        setAuthSuccess('Account created successfully!');
        if (res.data.accessToken) {
          localStorage.setItem('nuraiyan_token', res.data.accessToken);
        }
        if (res.data.user) {
          setCurrentUser(res.data.user);
        } else {
          await fetchCurrentUser();
        }
      } else {
        setAuthError(res.message || 'Registration failed.');
      }
    } catch (err: any) {
      setAuthError('Could not reach server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleStartCall = async (friend: any, type: 'AUDIO' | 'VIDEO') => {
    try {
      const res = await api.post('/calls', {
        receiverIds: [friend.id],
        type,
      });

      const callId = res.success && res.data ? res.data.id : `call_${Date.now()}`;

      setActiveCall({
        callId,
        otherUser: friend,
        type,
        isIncoming: false,
        status: 'RINGING',
      });
    } catch {
      setActiveCall({
        callId: `call_${Date.now()}`,
        otherUser: friend,
        type,
        isIncoming: false,
        status: 'RINGING',
      });
    }
  };

  const handlePostCreated = (newPost: any) => {
    setPosts([newPost, ...posts]);
  };

  const trendingTags = React.useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => {
      if (p.content) {
        const matches = p.content.match(/#[a-zA-Z0-9_]+/g);
        if (matches) {
          matches.forEach((tag: string) => {
            const clean = tag.replace('#', '');
            counts[clean] = (counts[clean] || 0) + 1;
          });
        }
      }
    });
    return Object.entries(counts)
      .map(([tag, count]) => ({
        tag,
        posts: `${count} ${count === 1 ? 'post' : 'posts'}`,
        category: 'Feed Topic',
      }))
      .sort((a, b) => parseInt(b.posts) - parseInt(a.posts))
      .slice(0, 5);
  }, [posts]);

  // Real Friends sorted by real-time online presence, then by most recent activity
  const sortedFriends = React.useMemo(() => {
    return [...friends].sort((a, b) => {
      const aOnline = onlineUsers.includes(a.id);
      const bOnline = onlineUsers.includes(b.id);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      const aTime = new Date(userLastSeen[a.id] || a.lastSeenAt || 0).getTime();
      const bTime = new Date(userLastSeen[b.id] || b.lastSeenAt || 0).getTime();
      return bTime - aTime;
    });
  }, [friends, onlineUsers, userLastSeen]);

  // Hydration-safe loading splash screen
  if (!mounted || (isLoadingUser && !currentUser)) {
    return (
      <div className="min-h-screen bg-[#070A12] flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-2xl shadow-rose-950/50">
          N
        </div>
        <p className="mt-4 text-xs font-semibold text-rose-300/80 tracking-widest uppercase animate-pulse">
          Nuraiyan
        </p>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // 1. UNLOGGED VIEW: MATURE, DIGNIFIED ROMANTIC DEDICATION
  // ═════════════════════════════════════════════════════════════
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col justify-between selection:bg-rose-500/30 selection:text-rose-200 relative overflow-hidden font-sans">
        {/* Dynamic Aesthetic Cosmic & Aurora Animated Background */}
        <AestheticCosmicBackground />

        {/* Top Header Bar with Glassmorphism */}
        <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-white/[0.08] backdrop-blur-md bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-indigo-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-rose-950/50 ring-1 ring-white/20">
              N
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Nuraiyan</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Token of Love
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Nusrat Jahan &amp; Raiyan Khan Joy</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-rose-300/80 bg-rose-950/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-rose-500/30 shadow-sm shadow-rose-500/10">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
            <span className="font-medium tracking-wide">Eternal Devotion</span>
          </div>
        </header>

        {/* Main Split Section: Romantic Letter + Auth Form */}
        <main className="relative z-10 max-w-7xl mx-auto w-full px-6 py-10 lg:py-16 flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-14">
          {/* Left Column: Unique Animated Falling Petals & Floating Heart Letter */}
          <AnimatedLoveLetter />

          {/* Right Column: Moving Unique Animated Love Auth Card */}
          <AnimatedAuthCard
            authTab={authTab}
            setAuthTab={setAuthTab}
            loginData={loginData as any}
            setLoginData={setLoginData as any}
            registerData={registerData as any}
            setRegisterData={setRegisterData as any}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            authLoading={authLoading}
            authError={authError}
            authSuccess={authSuccess}
            onLoginSubmit={handleLoginSubmit}
            onRegisterSubmit={handleRegisterSubmit}
          />
        </main>

        {/* Footer */}
        <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 border-t border-white/[0.08] backdrop-blur-md bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Nuraiyan. Crafted with everlasting love &amp; respect.</p>
          <p className="flex items-center gap-1.5 text-slate-300 font-medium">
            <span>Raiyan Khan Joy</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span>Nusrat Jahan</span>
          </p>
        </footer>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // 2. LOGGED IN VIEW: COMPLETE LUXURY SOCIAL PLATFORM
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Ambient Aurora Orbs */}
      <div className="fixed -top-40 -left-40 w-[600px] h-[600px] bg-rose-600/[0.12] rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/4 -right-40 w-[600px] h-[600px] bg-indigo-600/[0.12] rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed -bottom-40 left-1/3 w-[500px] h-[500px] bg-purple-600/[0.08] rounded-full blur-[140px] pointer-events-none" />

      {/* Top Navbar */}
      <Navbar onOpenCreatePost={() => setIsCreatePostOpen(true)} />

      {/* Main Layout Container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex justify-between gap-6 py-6 flex-1 relative z-10">
        {/* Left Sidebar Navigation */}
        <Sidebar />

        {/* Center Main Feed */}
        <main className="flex-1 max-w-2xl mx-auto w-full">
          {/* Stories Bar */}
          <StoriesBar />

          {/* Real-time Live Stream Announcement Banner */}
          {activeLiveStreams.length > 0 && (
            <div className="mb-5 bg-gradient-to-r from-rose-950/80 via-[#111726]/90 to-indigo-950/80 backdrop-blur-xl border border-rose-500/30 rounded-2xl p-4 shadow-xl shadow-rose-950/40 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="relative shrink-0">
                  <UserAvatar
                    avatarUrl={activeLiveStreams[0].host?.avatarUrl}
                    name={activeLiveStreams[0].host?.displayName}
                    size="md"
                    className="ring-2 ring-rose-500"
                  />
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    Live
                  </span>
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                      {activeLiveStreams[0].host?.displayName || 'A user'} is LIVE now!
                    </span>
                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 shrink-0 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      <Eye className="w-3 h-3" />
                      {activeLiveStreams[0].viewerCount || 1} watching
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate mt-0.5">
                    {activeLiveStreams[0].title || 'Live video broadcast'}
                  </p>
                </div>
              </div>
              <Link
                href={`/live?id=${activeLiveStreams[0].id || activeLiveStreams[0].streamId}`}
                className="px-4 py-2 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-rose-500/30 transition-all flex items-center gap-1.5 shrink-0 hover:scale-105 active:scale-95"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Watch Live</span>
              </Link>
            </div>
          )}

          {/* Quick Create Post Bar */}
          {(() => {
            const userFirstName = currentUser?.displayName
              ? currentUser.displayName.includes('@')
                ? currentUser.displayName.split('@')[0]
                : currentUser.displayName.split(' ')[0]
              : currentUser?.username || 'there';

            return (
              <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/[0.08] hover:border-white/[0.14] transition-all mb-5">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <UserAvatar
                      avatarUrl={currentUser?.avatarUrl}
                      name={currentUser?.displayName}
                      username={currentUser?.username}
                      size="md"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                  </div>
                  <button
                    onClick={() => setIsCreatePostOpen(true)}
                    className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] text-left text-slate-400 hover:text-slate-200 text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-white/[0.08] transition-all cursor-pointer shadow-inner"
                  >
                    What&apos;s on your mind, {userFirstName}?
                  </button>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.06] text-xs">
                  <button
                    onClick={() => setIsCreatePostOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer font-medium"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Photos &amp; Video</span>
                  </button>
                  <button
                    onClick={() => setIsCreatePostOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer font-medium"
                  >
                    <Music className="w-4 h-4" />
                    <span>Music</span>
                  </button>
                  <button
                    onClick={() => setIsCreatePostOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer font-medium"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Feelings</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Loading Skeleton */}
          {loadingPosts && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-[#111726]/80 rounded-3xl p-6 border border-white/[0.08] animate-pulse space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/[0.08]" />
                    <div className="space-y-2 flex-1">
                      <div className="w-32 h-3.5 bg-white/[0.08] rounded" />
                      <div className="w-24 h-2.5 bg-white/[0.04] rounded" />
                    </div>
                  </div>
                  <div className="w-full h-14 bg-white/[0.04] rounded-2xl" />
                  <div className="w-full h-52 bg-white/[0.08] rounded-2xl" />
                </div>
              ))}
            </div>
          )}

          {/* Real Feed Posts */}
          {!loadingPosts && posts.length > 0 && (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
                />
              ))}
            </div>
          )}

          {/* Clean Empty Feed State when no posts exist yet */}
          {!loadingPosts && posts.length === 0 && (
            <div className="space-y-4">
              {/* Welcome Hero Banner */}
              <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#111726] via-[#14172a] to-[#0f1020] shadow-2xl">
                {/* Glowing orbs inside card */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-white text-lg leading-tight">Welcome to Nuraiyan!</h2>
                      <p className="text-rose-300 text-xs font-medium">Your feed is ready — start your journey</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-5">
                    Share a post, upload a story, or explore what the community is creating. Your first post is just one click away.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setIsCreatePostOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-500/20 border border-white/20 transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                      <span>Create First Post</span>
                    </button>
                    <button
                      onClick={loadFeed}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white font-semibold text-sm rounded-xl border border-white/[0.1] transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Feature Cards Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Photos & Video */}
                <button
                  onClick={() => setIsCreatePostOpen(true)}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111726]/80 backdrop-blur-xl p-5 text-left hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all cursor-pointer shadow-lg"
                >
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Camera className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Share Photos</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Upload moments, memories &amp; media</p>
                </button>

                {/* Music */}
                <button
                  onClick={() => setIsCreatePostOpen(true)}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111726]/80 backdrop-blur-xl p-5 text-left hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all cursor-pointer shadow-lg"
                >
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Music className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Post with Music</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Attach songs to your stories &amp; posts</p>
                </button>

                {/* Live Stream */}
                <button
                  onClick={() => window.location.href = '/live'}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111726]/80 backdrop-blur-xl p-5 text-left hover:border-rose-500/30 hover:bg-rose-500/5 transition-all cursor-pointer shadow-lg"
                >
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
                  <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Radio className="w-5 h-5 text-rose-400" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Go Live</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Start a real-time live stream</p>
                </button>

                {/* Messages */}
                <button
                  onClick={() => window.location.href = '/messages'}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111726]/80 backdrop-blur-xl p-5 text-left hover:border-amber-500/30 hover:bg-amber-500/5 transition-all cursor-pointer shadow-lg"
                >
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Send Messages</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Chat privately or in groups</p>
                </button>
              </div>

              {/* Quick Tips Card */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#111726]/60 backdrop-blur-xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <h4 className="font-bold text-white text-sm">Quick Tips</h4>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: '✍️', tip: 'Write a post and include #hashtags to start trending' },
                    { icon: '📸', tip: 'Upload photos or videos directly from your device' },
                    { icon: '🎵', tip: 'Add a song to any post from our global music catalog' },
                    { icon: '🔴', tip: 'Go live anytime to broadcast to your followers' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                      <span className="text-base leading-none mt-0.5">{item.icon}</span>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>

        {/* Right Panel: Active Members & Real Suggestions */}
        <aside className="w-80 hidden xl:flex flex-col gap-4 sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto pr-1 scrollbar-none">

          {/* Current User Profile Card */}
          {currentUser && (
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#111726] to-[#14172a] shadow-xl p-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-3 mb-4">
                <div className="relative">
                  <UserAvatar
                    avatarUrl={currentUser?.avatarUrl}
                    name={currentUser?.displayName}
                    username={currentUser?.username}
                    size="md"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{currentUser?.displayName}</p>
                  <p className="text-xs text-slate-400 truncate">@{currentUser?.username}</p>
                </div>
              </div>
              <a
                href={`/profile/${currentUser?.username}`}
                className="relative flex items-center justify-center w-full py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white transition-all gap-2 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                View Profile
              </a>
            </div>
          )}

          {/* Real-Time Active Friends */}
          <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/[0.08]">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h3 className="font-bold text-white text-xs">Active Friends</h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                {friends.filter((f) => onlineUsers.includes(f.id)).length} Online
              </span>
            </div>

            <div className="space-y-1.5">
              {sortedFriends.length === 0 ? (
                <div className="py-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                    <Users className="w-5 h-5 text-slate-500" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300 mb-1">No friends connected yet</p>
                  <p className="text-[11px] text-slate-500 mb-2">Connect with friends to see live status &amp; call</p>
                  <Link
                    href="/friends"
                    className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold"
                  >
                    <span>Find Friends</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                sortedFriends.map((user: any) => {
                  const isOnline = onlineUsers.includes(user.id);
                  const lastSeen = userLastSeen[user.id] || user.lastSeenAt;

                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Link href={`/profile/${user.username}`} className="relative shrink-0">
                          <UserAvatar
                            avatarUrl={user.avatarUrl}
                            name={user.displayName}
                            username={user.username}
                            size="sm"
                            className={isOnline ? 'ring-2 ring-emerald-500/40' : ''}
                          />
                          {isOnline ? (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                          ) : (
                            <span className="absolute bottom-0 right-0 w-2 h-2 bg-slate-600 rounded-full ring-2 ring-[#111726]" />
                          )}
                        </Link>
                        <div className="min-w-0">
                          <Link
                            href={`/profile/${user.username}`}
                            className="font-semibold text-white text-xs leading-none truncate block hover:text-rose-300 transition-colors"
                          >
                            {user.displayName}
                          </Link>
                          {isOnline ? (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Active now</span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 mt-1 truncate">
                              {formatLastActive(lastSeen)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartCall(user, 'AUDIO')}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
                          title="Audio Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStartCall(user, 'VIDEO')}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
                          title="Video Call"
                        >
                          <VideoIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const socket = getSocket();
                            const gameId = `ludo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                            socket.emit('ludo:invite', { targetUserId: user.id, gameId });
                            alert(`Challenged ${user.displayName} to a Ludo match! 🎲`);
                          }}
                          className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-lg transition-colors text-xs cursor-pointer"
                          title="Challenge to Ludo"
                        >
                          🎲
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Trending Topics */}
          <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/[0.08]">
            <div className="flex items-center gap-2 pb-2.5 border-b border-white/[0.06] mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              <h3 className="font-bold text-white text-xs">Trending Hashtags</h3>
            </div>

            <div className="space-y-2">
              {trendingTags.length === 0 ? (
                <div className="py-4 text-center">
                  <div className="text-2xl mb-2">✍️</div>
                  <p className="text-xs font-medium text-slate-300 mb-0.5">No hashtags yet</p>
                  <p className="text-[11px] text-slate-500">Add #tags to your posts to trend!</p>
                </div>
              ) : (
                trendingTags.map((item, idx) => (
                  <div key={idx} className="cursor-pointer group flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors">
                    <span className="text-base font-black text-rose-500/40 group-hover:text-rose-500/60 leading-none">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-slate-200 group-hover:text-rose-400 transition-colors truncate">#{item.tag}</p>
                      <span className="text-[10px] text-slate-500">{item.posts}</span>
                    </div>
                    <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Platform Features Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 to-purple-500/5 p-4 shadow-lg">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <h4 className="font-bold text-white text-xs">Platform Features</h4>
              </div>
              <div className="space-y-2">
                {[
                  { icon: '🎥', label: 'HD Video Calling', sub: 'WebRTC peer-to-peer' },
                  { icon: '📡', label: 'Live Streaming', sub: 'Broadcast to anyone' },
                  { icon: '🎮', label: 'Ludo Game', sub: 'Challenge your friends' },
                  { icon: '💬', label: 'Encrypted Chat', sub: 'Vanish mode included' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1.5">
                    <span className="text-sm">{f.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-white leading-none">{f.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{f.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Minimal Footer */}
          <div className="px-2 text-[10px] text-slate-500 leading-normal flex flex-wrap gap-x-2.5 gap-y-1">
            <a href="/privacy" className="hover:text-slate-200 transition-colors">Privacy</a>
            <span>•</span>
            <a href="/terms" className="hover:text-slate-200 transition-colors">Terms</a>
            <span>•</span>
            <a href="/help" className="hover:text-slate-200 transition-colors">Help</a>
            <span>•</span>
            <span>© 2026 Nuraiyan</span>
          </div>
        </aside>
      </div>

      {/* Post Creator Modal */}


      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}