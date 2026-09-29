'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Send,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Music,
  Edit3,
  Trash2,
  X,
  Check,
  Globe,
  Users,
  Lock,
  Loader2,
  CornerDownRight,
} from 'lucide-react';
import { formatDate, isVideoUrl } from '../lib/utils';
import { useStore } from '../store/useStore';
import { api, resolveMediaUrl } from '../lib/api';
import { MusicPicker, SelectedSong } from './MusicPicker';
import { UserAvatar } from './UserAvatar';
import { ReactionsModal } from './ReactionsModal';

export interface PostProps {
  post: {
    id: string;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string;
      isVerified?: boolean;
    };
    content?: string;
    mediaUrls?: string[];
    mediaType?: string | null;
    musicTitle?: string | null;
    musicArtist?: string | null;
    musicUrl?: string | null;
    musicStartSec?: number | null;
    musicEndSec?: number | null;
    privacy?: string;
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    hasLiked?: boolean;
    userReaction?: string | null;
    distinctReactions?: string[];
    createdAt: string;
    comments?: any[];
  };
  onDelete?: () => void;
}


export const PostCard: React.FC<PostProps> = ({ post, onDelete }) => {
  const { currentUser, isMuted, toggleMute } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Post Data State
  const [content, setContent] = useState(post.content || '');
  const [musicTitle, setMusicTitle] = useState(post.musicTitle || null);
  const [musicArtist, setMusicArtist] = useState(post.musicArtist || null);
  const [musicUrl, setMusicUrl] = useState(post.musicUrl || null);
  const [isDeleted, setIsDeleted] = useState(false);

  // Engagement States
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [hasLiked, setHasLiked] = useState(post.hasLiked || false);
  const [userReaction, setUserReaction] = useState<string | null>(post.userReaction || null);
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const musicLoopIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const [comments, setComments] = useState<any[]>(post.comments || []);
  const [commentsCount, setCommentsCount] = useState<number>(post.commentsCount ?? (post.comments?.length || 0));
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [commentId: string]: string }>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [sharesCount, setSharesCount] = useState(post.sharesCount || 0);

  // 🔇 Immediately pause audio if user enables mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (isMuted) {
        audioRef.current.pause();
        setIsPlayingMusic(false);
      }
    }
  }, [isMuted]);

  // 🎵 Automatic Music Autoplay when in Viewport (Only if unmuted!)
  useEffect(() => {
    if (!musicUrl || !cardRef.current) return;

    let isVisible = false;

    const startAudio = () => {
      if (isMuted) return; // Do not autoplay sound when muted!
      const audio = audioRef.current;
      if (!audio) return;
      audio.muted = false;
      if (post.musicStartSec !== undefined && post.musicStartSec !== null) {
        if (Math.abs(audio.currentTime - post.musicStartSec) > 1 && (audio.currentTime === 0 || audio.paused)) {
          audio.currentTime = post.musicStartSec;
        }
      }
      audio
        .play()
        .then(() => setIsPlayingMusic(true))
        .catch(() => {
          // Autoplay blocked by browser policy without user gesture;
          // listen for first interaction on window to auto-start if unmuted!
          const onFirstInteraction = () => {
            if (audioRef.current && isVisible && !useStore.getState().isMuted) {
              if (post.musicStartSec !== undefined && post.musicStartSec !== null && audioRef.current.currentTime === 0) {
                audioRef.current.currentTime = post.musicStartSec;
              }
              audioRef.current.muted = false;
              audioRef.current.play().then(() => setIsPlayingMusic(true)).catch(() => {});
            }
            window.removeEventListener('pointerdown', onFirstInteraction);
            window.removeEventListener('keydown', onFirstInteraction);
            window.removeEventListener('scroll', onFirstInteraction);
          };
          window.addEventListener('pointerdown', onFirstInteraction, { once: true });
          window.addEventListener('keydown', onFirstInteraction, { once: true });
          window.addEventListener('scroll', onFirstInteraction, { once: true });
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            isVisible = true;
            if (!isMuted) {
              startAudio();
            }
          } else {
            isVisible = false;
            if (audioRef.current) {
              audioRef.current.pause();
              setIsPlayingMusic(false);
            }
          }
        });
      },
      { threshold: [0.35] }
    );

    observer.observe(cardRef.current);
    return () => {
      observer.disconnect();
      if (musicLoopIntervalRef.current) clearInterval(musicLoopIntervalRef.current);
    };
  }, [musicUrl, post.musicStartSec, (post as any).musicEndSec, isMuted]);

  // 🔁 Handle looping precisely within the selected clip segment
  useEffect(() => {
    if (!isPlayingMusic || !audioRef.current) return;
    const start = post.musicStartSec || 0;
    const end = (post as any).musicEndSec || (post.musicStartSec !== undefined && post.musicStartSec !== null ? post.musicStartSec + 30 : null);

    if (end) {
      const interval = setInterval(() => {
        if (audioRef.current && audioRef.current.currentTime >= end) {
          audioRef.current.currentTime = start;
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [isPlayingMusic, post.musicStartSec, (post as any).musicEndSec]);

  // Post Options Menu & Edit Modal
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editSong, setEditSong] = useState<SelectedSong | null>(
    post.musicTitle && post.musicUrl
      ? {
          title: post.musicTitle,
          artist: post.musicArtist || '',
          url: post.musicUrl,
        }
      : null
  );
  const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);

  const isAuthor =
    currentUser?.id === post.author.id ||
    currentUser?.username?.toLowerCase() === post.author.username?.toLowerCase();

  const reactions = [
    { type: 'LIKE', label: 'Like', emoji: '👍', color: 'text-blue-400 font-bold' },
    { type: 'LOVE', label: 'Love', emoji: '❤️', color: 'text-rose-500 font-bold' },
    { type: 'CARE', label: 'Care', emoji: '🥰', color: 'text-amber-400 font-bold' },
    { type: 'HAHA', label: 'Haha', emoji: '😆', color: 'text-amber-400 font-bold' },
    { type: 'WOW', label: 'Wow', emoji: '😮', color: 'text-amber-400 font-bold' },
    { type: 'SAD', label: 'Sad', emoji: '😢', color: 'text-amber-400 font-bold' },
    { type: 'ANGRY', label: 'Angry', emoji: '😡', color: 'text-orange-500 font-bold' },
  ];

  const [activeReactions, setActiveReactions] = useState<string[]>(
    post.distinctReactions || (post.userReaction ? [post.userReaction] : [])
  );
  const [isReactionsModalOpen, setIsReactionsModalOpen] = useState(false);

  const reactionEmojiMap: Record<string, string> = {
    LIKE: '👍',
    LOVE: '❤️',
    CARE: '🥰',
    HAHA: '😆',
    WOW: '😮',
    SAD: '😢',
    ANGRY: '😡',
  };

  const getDisplayEmojis = () => {
    const list: string[] = [];
    if (userReaction && reactionEmojiMap[userReaction]) {
      list.push(reactionEmojiMap[userReaction]);
    }
    if (activeReactions && activeReactions.length > 0) {
      activeReactions.forEach((t) => {
        const emoji = reactionEmojiMap[t];
        if (emoji && !list.includes(emoji)) {
          list.push(emoji);
        }
      });
    }
    if (list.length === 0 && likesCount > 0) {
      list.push('👍');
    }
    return list.slice(0, 3);
  };

  if (isDeleted) {
    return null;
  }

  // Graceful reaction bar hover handlers with generous timeout
  const handleReactionAreaEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowReactions(true);
  };

  const handleReactionAreaLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowReactions(false);
    }, 450);
  };

  const handleToggleLike = async () => {
    const nextState = !hasLiked;
    const nextReaction = nextState ? 'LIKE' : null;
    setHasLiked(nextState);
    setUserReaction(nextReaction);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    if (nextState) {
      setActiveReactions((prev) => Array.from(new Set([...prev, 'LIKE'])));
    } else {
      if (likesCount <= 1) {
        setActiveReactions([]);
      }
    }

    try {
      const res = await api.post(`/posts/${post.id}/like`, { type: 'LIKE' });
      if (res.success) {
        if (typeof res.likesCount === 'number') {
          setLikesCount(res.likesCount);
        }
        if (Array.isArray(res.distinctReactions)) {
          setActiveReactions(res.distinctReactions);
        }
        if (res.action === 'unliked') {
          setHasLiked(false);
          setUserReaction(null);
        } else {
          setHasLiked(true);
          setUserReaction(res.type || 'LIKE');
        }
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleSelectReaction = async (type: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowReactions(false);

    // If user clicks the reaction they already have, it toggles it off (unlike)
    const isUnliking = hasLiked && userReaction === type;

    if (isUnliking) {
      setHasLiked(false);
      setUserReaction(null);
      setLikesCount((prev) => Math.max(0, prev - 1));
    } else {
      if (!hasLiked) {
        setLikesCount((prev) => prev + 1);
      }
      setHasLiked(true);
      setUserReaction(type);
      setActiveReactions((prev) => Array.from(new Set([...prev, type])));
    }

    try {
      const res = await api.post(`/posts/${post.id}/like`, { type });
      if (res.success) {
        if (typeof res.likesCount === 'number') {
          setLikesCount(res.likesCount);
        }
        if (Array.isArray(res.distinctReactions)) {
          setActiveReactions(res.distinctReactions);
        }
        if (res.action === 'unliked') {
          setHasLiked(false);
          setUserReaction(null);
        } else {
          setHasLiked(true);
          setUserReaction(res.type || type);
        }
      }
    } catch (err) {
      console.error('Reaction error:', err);
    }
  };

  const handleOpenComments = async () => {
    const nextShow = !showComments;
    setShowComments(nextShow);

    if (nextShow) {
      setLoadingComments(true);
      try {
        const res = await api.get(`/posts/${post.id}`);
        if (res.success && res.data?.comments) {
          setComments(res.data.comments);
        }
        if (res.success && res.data?.commentsCount !== undefined) {
          setCommentsCount(res.data.commentsCount);
        }
      } catch (err) {
        console.error('Load comments error:', err);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const sendContent = commentText.trim();
    setCommentText('');

    const optimisticComment = {
      id: `c_${Date.now()}`,
      content: sendContent,
      createdAt: new Date().toISOString(),
      user: {
        id: currentUser?.id || 'me',
        username: currentUser?.username || 'you',
        displayName: currentUser?.displayName || 'You',
        avatarUrl: currentUser?.avatarUrl || '',
      },
      replies: [],
    };

    setComments((prev) => [...prev, optimisticComment]);
    setCommentsCount((prev) => prev + 1);

    try {
      const res = await api.post(`/posts/${post.id}/comment`, { content: sendContent });
      if (res.success && res.data) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === optimisticComment.id ? { ...res.data, replies: res.data.replies || [] } : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  };

  const handleAddReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    const text = (replyText[parentId] || '').trim();
    if (!text) return;

    setSubmittingReplyId(parentId);

    const optimisticReply = {
      id: `reply_${Date.now()}`,
      postId: post.id,
      parentId,
      content: text,
      createdAt: new Date().toISOString(),
      user: {
        id: currentUser?.id || 'me',
        username: currentUser?.username || 'you',
        displayName: currentUser?.displayName || 'You',
        avatarUrl: currentUser?.avatarUrl || '',
      },
    };

    setComments((prev) =>
      prev.map((c) => {
        if (c.id === parentId) {
          return {
            ...c,
            replies: [...(c.replies || []), optimisticReply],
          };
        }
        return c;
      })
    );

    setCommentsCount((prev) => prev + 1);
    setReplyText((prev) => ({ ...prev, [parentId]: '' }));
    setReplyingToId(null);

    try {
      const res = await api.post(`/posts/${post.id}/comment`, {
        content: text,
        parentId,
      });
      if (res.success && res.data) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: (c.replies || []).map((r: any) =>
                  r.id === optimisticReply.id ? res.data : r
                ),
              };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setSubmittingReplyId(null);
    }
  };

  const handleToggleSave = async () => {
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    try {
      await api.post(`/posts/${post.id}/save`);
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleShare = async () => {
    setSharesCount((prev) => prev + 1);
    try {
      await api.post(`/posts/${post.id}/share`, {});
      if (typeof window !== 'undefined') {
        navigator.clipboard?.writeText(window.location.origin + `/posts/${post.id}`).catch(() => {});
      }
      alert('Post link copied to clipboard!');
    } catch {
      alert('Post link copied to clipboard!');
    }
  };

  // ── Post Edit Save ──────────────────────────────────────────
  const handleSavePostEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);

    try {
      const res = await api.patch(`/posts/${post.id}`, {
        content: editContent.trim(),
        musicTitle: editSong?.title || null,
        musicArtist: editSong?.artist || null,
        musicUrl: editSong?.url || null,
      });

      if (res.success) {
        setContent(editContent.trim());
        setMusicTitle(editSong?.title || null);
        setMusicArtist(editSong?.artist || null);
        setMusicUrl(editSong?.url || null);
        setIsEditModalOpen(false);
      } else {
        alert(res.message || 'Failed to edit post.');
      }
    } catch (err) {
      alert('An error occurred while editing post.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Post Delete ─────────────────────────────────────────────
  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    setDeletingPost(true);
    try {
      const res = await api.delete(`/posts/${post.id}`);
      if (res.success) {
        setIsDeleted(true);
        if (onDelete) onDelete();
      } else {
        alert(res.message || 'Failed to delete post.');
      }
    } catch (err) {
      alert('Could not connect to server.');
    } finally {
      setDeletingPost(false);
      setIsMenuOpen(false);
    }
  };

  const currentReactionObj = reactions.find((r) => r.type === userReaction);
  const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0) || commentsCount;

  return (
    <article ref={cardRef} className="w-full bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-xl border border-white/[0.08] hover:border-white/[0.12] mb-4 transition-all relative text-slate-100">
      {/* Post Author Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            avatarUrl={post.author.avatarUrl}
            name={post.author.displayName}
            username={post.author.username}
            size="md"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-white text-sm">{post.author.displayName}</h4>
              {post.author.isVerified && (
                <span className="w-4 h-4 bg-gradient-to-tr from-rose-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              @{post.author.username} • {formatDate(post.createdAt)}
            </p>
          </div>
        </div>

        {/* Options Menu for Author */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-10 w-48 bg-[#182032] rounded-2xl shadow-2xl border border-white/[0.1] py-1.5 z-30 animate-in fade-in duration-150 text-slate-200">
              {isAuthor && (
                <>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditModalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit Caption &amp; Music</span>
                  </button>

                  <button
                    onClick={handleDeletePost}
                    disabled={deletingPost}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete Post</span>
                  </button>
                  <div className="my-1 border-t border-white/[0.08]" />
                </>
              )}

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleShare();
                }}
                className="w-full px-4 py-2 text-left text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white flex items-center gap-2 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Link</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post Content */}
      {content && (
        <p className="text-slate-200 text-sm sm:text-base leading-relaxed mb-4 whitespace-pre-line font-normal">
          {content}
        </p>
      )}

      {/* Background Music Bar with Live Visualizer and Autoplay */}
      {musicTitle && (
        <div className="mb-4 p-3 bg-gradient-to-r from-rose-500/15 via-indigo-500/10 to-transparent border border-rose-500/20 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (!audioRef.current) return;
                if (isPlayingMusic) {
                  audioRef.current.pause();
                  setIsPlayingMusic(false);
                } else {
                  if (post.musicStartSec !== undefined && post.musicStartSec !== null && audioRef.current.currentTime === 0) {
                    audioRef.current.currentTime = post.musicStartSec;
                  }
                  audioRef.current.play().catch(() => {});
                  setIsPlayingMusic(true);
                }
              }}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 hover:scale-105 transition-all shadow-md shadow-rose-500/20 cursor-pointer"
              title={isPlayingMusic ? 'Pause Music' : 'Play Music'}
            >
              {isPlayingMusic ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-white truncate">
                  {musicTitle}
                </p>
                {isPlayingMusic && (
                  <span className="flex items-end gap-0.5 h-3.5 text-rose-400">
                    <span className="w-1 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
                    <span className="w-1 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
                    <span className="w-1 bg-rose-400 rounded-full animate-bounce h-2" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-rose-300/80 truncate">
                {musicArtist && <span>{musicArtist}</span>}
                {post.musicStartSec !== undefined && post.musicStartSec !== null && (
                  <span className="font-mono text-slate-400">
                    • ✂️ {Math.floor(post.musicStartSec / 60)}:{(post.musicStartSec % 60).toString().padStart(2, '0')}
                    {(post as any).musicEndSec ? ` - ${Math.floor((post as any).musicEndSec / 60)}:${((post as any).musicEndSec % 60).toString().padStart(2, '0')}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          {musicUrl && (
            <audio
              ref={audioRef}
              src={resolveMediaUrl(musicUrl)}
              onEnded={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = post.musicStartSec || 0;
                  audioRef.current.play().catch(() => {});
                }
              }}
              onError={() => setIsPlayingMusic(false)}
            />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const willBeMuted = !isMuted;
              toggleMute();
              if (!willBeMuted && audioRef.current) {
                audioRef.current.muted = false;
                audioRef.current.play().then(() => setIsPlayingMusic(true)).catch(() => {});
              }
            }}
            className="text-[10px] font-bold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 px-3 py-1.5 rounded-full flex-shrink-0 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 select-none"
            title={isMuted ? 'Click to play sound' : 'Click to mute sound'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span>Muted (Click to Play)</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>Sound On (Click to Mute)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Post Media (Images / Video) */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mb-4 rounded-2xl overflow-hidden border border-white/[0.1] bg-black/60 shadow-lg">
          {post.mediaType === 'VIDEO' || isVideoUrl(post.mediaUrls[0]) ? (
            <div className="relative group/video">
              <video
                src={resolveMediaUrl(post.mediaUrls[0])}
                controls
                preload="metadata"
                playsInline
                muted={isMuted}
                className="w-full max-h-[520px] object-contain bg-black"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="absolute top-3 right-3 px-2.5 py-1.5 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg flex items-center gap-1.5 z-10 select-none hover:scale-105"
                title={isMuted ? 'Click to unmute video' : 'Click to mute video'}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[10px] font-bold text-slate-200">Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-300">Sound On</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <img
              src={resolveMediaUrl(post.mediaUrls[0])}
              alt="Post media"
              className="w-full max-h-[520px] object-cover"
            />
          )}
        </div>
      )}

      {/* Post Stats */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5">
          {likesCount > 0 ? (
            <button
              type="button"
              onClick={() => setIsReactionsModalOpen(true)}
              className="flex items-center gap-1.5 hover:underline cursor-pointer group select-none text-left"
              title="See who reacted"
            >
              <span className="flex items-center -space-x-1 text-sm select-none">
                {getDisplayEmojis().map((emoji, idx) => (
                  <span
                    key={idx}
                    className="inline-block transform group-hover:scale-115 transition-transform"
                  >
                    {emoji}
                  </span>
                ))}
              </span>
              <span className="font-bold text-slate-200 ml-0.5 group-hover:text-blue-400 transition-colors">
                {likesCount}
              </span>
            </button>
          ) : (
            <span className="text-slate-500 text-[11px]">Be the first to react</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>{totalComments} {totalComments === 1 ? 'comment' : 'comments'}</span>
          <span>{sharesCount} shares</span>
        </div>
      </div>

      {/* Action Buttons: Like, Comment, Share, Bookmark */}
      <div className="flex items-center justify-between pt-2.5 text-slate-300 relative">
        <div
          className="relative inline-block"
          onMouseEnter={handleReactionAreaEnter}
          onMouseLeave={handleReactionAreaLeave}
        >
          {showReactions && (
            <div
              className="absolute bottom-full left-0 mb-1 z-30 flex items-center gap-1.5 bg-[#182032] border border-white/[0.15] shadow-2xl rounded-full px-2.5 py-1.5 animate-in fade-in zoom-in-95 before:absolute before:inset-x-0 before:top-full before:h-4 before:content-['']"
              onMouseEnter={handleReactionAreaEnter}
              onMouseLeave={handleReactionAreaLeave}
            >
              {reactions.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectReaction(r.type);
                  }}
                  className="hover:scale-135 active:scale-95 transition-transform text-xl p-1 rounded-full hover:bg-white/10 cursor-pointer flex items-center justify-center"
                  title={r.label}
                >
                  <span className="leading-none">{r.emoji}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              hasLiked
                ? `${currentReactionObj?.color || 'text-rose-400 font-bold'} bg-white/[0.06]`
                : 'hover:bg-white/[0.08] text-slate-300 hover:text-white'
            }`}
          >
            {hasLiked && currentReactionObj ? (
              <span className="text-base leading-none">{currentReactionObj.emoji}</span>
            ) : (
              <Heart className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-xs">{hasLiked && currentReactionObj ? currentReactionObj.label : 'Like'}</span>
          </button>
        </div>

        <button
          onClick={handleOpenComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 text-slate-500" />
          <span className="text-xs">
            Comment{totalComments > 0 ? ` (${totalComments})` : ''}
          </span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-slate-500" />
          <span className="text-xs">Share</span>
        </button>

        <button
          onClick={handleToggleSave}
          className={`p-2 rounded-xl transition-colors cursor-pointer ${
            isSaved ? 'text-indigo-600 bg-indigo-50' : 'hover:bg-slate-100 text-slate-400'
          }`}
          title={isSaved ? 'Saved' : 'Save Post'}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-indigo-600' : ''}`} />
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-3">
          {/* Add Comment Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <UserAvatar
              avatarUrl={currentUser?.avatarUrl}
              name={currentUser?.displayName}
              username={currentUser?.username}
              size="xs"
            />
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 bg-white/[0.05] text-xs px-4 py-2.5 rounded-xl border border-white/[0.1] text-white placeholder-slate-400 focus:bg-white/[0.1] focus:border-rose-500/50 focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="p-2.5 bg-gradient-to-tr from-rose-500 to-indigo-600 hover:opacity-90 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-rose-500/20 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Comments List */}
          {loadingComments && (
            <p className="text-[11px] text-slate-400 text-center py-2">Loading comments...</p>
          )}

          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              <div className="flex items-start gap-2.5 text-xs group">
                <UserAvatar
                  avatarUrl={comment.user?.avatarUrl}
                  name={comment.user?.displayName}
                  username={comment.user?.username}
                  size="xs"
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/[0.06] hover:border-white/[0.12] transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-rose-300 text-[11px] truncate">
                        {comment.user?.displayName || comment.user?.username}
                      </span>
                      {comment.createdAt && (
                        <span className="text-[10px] text-slate-500 flex-shrink-0">
                          {formatDate(comment.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-200 text-xs mt-1 font-normal leading-relaxed whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>

                  {/* Comment Actions: Reply button & reply count */}
                  <div className="flex items-center gap-3 mt-1 ml-2 text-[11px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingToId(replyingToId === comment.id ? null : comment.id);
                        if (replyingToId !== comment.id) {
                          setReplyText((prev) => ({
                            ...prev,
                            [comment.id]: prev[comment.id] || '',
                          }));
                        }
                      }}
                      className="flex items-center gap-1 font-medium text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <CornerDownRight className="w-3 h-3" />
                      <span>Reply</span>
                    </button>
                    {comment.replies && comment.replies.length > 0 && (
                      <span className="text-[10px] text-slate-500">
                        • {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Nested Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-8 pl-3 border-l-2 border-white/10 space-y-2 mt-1.5">
                  {comment.replies.map((reply: any) => (
                    <div key={reply.id} className="flex items-start gap-2 text-xs">
                      <UserAvatar
                        avatarUrl={reply.user?.avatarUrl}
                        name={reply.user?.displayName}
                        username={reply.user?.username}
                        size="xs"
                        className="w-5 h-5 text-[9px] mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.05]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-rose-300/90 text-[10px] truncate">
                              {reply.user?.displayName || reply.user?.username}
                            </span>
                            {reply.createdAt && (
                              <span className="text-[9px] text-slate-500 flex-shrink-0">
                                {formatDate(reply.createdAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-200 text-xs mt-0.5 font-normal leading-relaxed whitespace-pre-wrap break-words">
                            {reply.content}
                          </p>
                        </div>
                        {/* Quick reply button for reply */}
                        <div className="flex items-center gap-2 mt-0.5 ml-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToId(comment.id);
                              const replyMention = `@${reply.user?.displayName || reply.user?.username} `;
                              setReplyText((prev) => ({
                                ...prev,
                                [comment.id]: replyMention,
                              }));
                            }}
                            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <CornerDownRight className="w-2.5 h-2.5" />
                            <span>Reply</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline Reply Form */}
              {replyingToId === comment.id && (
                <form
                  onSubmit={(e) => handleAddReply(e, comment.id)}
                  className="ml-8 pl-3 border-l-2 border-rose-500/40 flex items-center gap-2 pt-1 animate-in fade-in duration-150"
                >
                  <UserAvatar
                    avatarUrl={currentUser?.avatarUrl}
                    name={currentUser?.displayName}
                    username={currentUser?.username}
                    size="xs"
                    className="w-5 h-5 text-[9px]"
                  />
                  <input
                    type="text"
                    autoFocus
                    value={replyText[comment.id] || ''}
                    onChange={(e) =>
                      setReplyText((prev) => ({ ...prev, [comment.id]: e.target.value }))
                    }
                    placeholder={`Reply to ${comment.user?.displayName || comment.user?.username || 'user'}...`}
                    className="flex-1 bg-white/[0.05] text-xs px-3 py-2 rounded-xl border border-white/[0.1] text-white placeholder-slate-400 focus:bg-white/[0.1] focus:border-rose-500/50 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setReplyingToId(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="submit"
                    disabled={!(replyText[comment.id] || '').trim() || submittingReplyId === comment.id}
                    className="p-2 bg-gradient-to-tr from-rose-500 to-indigo-600 hover:opacity-90 disabled:opacity-40 text-white rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center"
                  >
                    {submittingReplyId === comment.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── EDIT POST MODAL ─────────────────────────────────────── */}
      {mounted && isEditModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-slate-700" />
                <span>Edit Post &amp; Music</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePostEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Edit Caption
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write your new caption..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:border-slate-800 focus:outline-none transition-all resize-none"
                />
              </div>

              {/* Background Music Selector in Edit */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Background Music
                </label>

                {editSong ? (
                  <div className="p-3 bg-pink-50/70 border border-pink-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Music className="w-4 h-4 text-pink-600 flex-shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {editSong.title}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">{editSong.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsMusicPickerOpen(true)}
                        className="text-xs text-pink-700 hover:underline font-medium"
                      >
                        Change Song
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSong(null)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        title="Remove Song"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsMusicPickerOpen(true)}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Music className="w-4 h-4 text-pink-500" />
                    <span>+ Add Background Music to Post</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEdit ? <span>Saving...</span> : <span>Save Changes</span>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Music Picker Modal if changing music on post */}
      {mounted && isMusicPickerOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#111726] rounded-3xl shadow-2xl overflow-hidden border border-white/10">
            <MusicPicker
              selectedSong={editSong}
              onSelectSong={(song) => {
                setEditSong(song);
                setIsMusicPickerOpen(false);
              }}
              onClose={() => setIsMusicPickerOpen(false)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Facebook-style Reactions List Modal (Who reacted) */}
      {isReactionsModalOpen && (
        <ReactionsModal
          isOpen={isReactionsModalOpen}
          onClose={() => setIsReactionsModalOpen(false)}
          postId={post.id}
        />
      )}
    </article>
  );
};
