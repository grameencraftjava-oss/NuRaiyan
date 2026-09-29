'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { Bookmark, Sparkles, Compass, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { PostCard } from '../../components/PostCard';
import Link from 'next/link';

export default function SavedPage() {
  const { currentUser } = useStore();
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    setLoading(true);
    try {
      const res = await api.get('/posts/saved');
      if (res.success && Array.isArray(res.data)) {
        setSavedPosts(res.data);
      } else {
        setSavedPosts([]);
      }
    } catch (err) {
      console.error('Failed to load saved posts:', err);
      setSavedPosts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 flex gap-6">
        <Sidebar />

        <main className="flex-1 min-w-0 max-w-2xl mx-auto space-y-5">
          {/* Header Banner */}
          <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <Bookmark className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                  <span>Saved Memories</span>
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    {savedPosts.length}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your private collection of bookmarked stories, photos, and music
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors"
              title="Back to Feed"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>

          {/* Feed of Saved Posts */}
          <div className="space-y-4">
            {loading ? (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs">Loading your saved moments...</p>
              </div>
            ) : savedPosts.length > 0 ? (
              savedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={() => setSavedPosts((prev) => prev.filter((p) => p.id !== post.id))}
                />
              ))
            ) : (
              <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-12 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-amber-400">
                  <Bookmark className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-white text-base">No saved memories yet</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    When you see a post or video you love, click the bookmark icon to save it here for later.
                  </p>
                </div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-rose-500/25 hover:opacity-95 transition-opacity"
                >
                  <Compass className="w-4 h-4" />
                  <span>Explore Feed</span>
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
