'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, ChevronLeft, ChevronRight, Send, Heart, Music, Volume2, VolumeX, Image as ImageIcon, Sparkles, Trash2, Eye, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MusicPicker, SelectedSong } from './MusicPicker';
import { api, resolveMediaUrl } from '../lib/api';
import { isVideoUrl } from '../lib/utils';
import { UserAvatar } from './UserAvatar';

interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption?: string;
  musicTitle?: string | null;
  musicArtist?: string | null;
  musicUrl?: string | null;
  musicStartSec?: number | null;
  musicEndSec?: number | null;
  viewsCount?: number;
  createdAt: string;
}


interface UserStoryGroup {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  hasUnseen: boolean;
  stories: StoryItem[];
}

export const StoriesBar: React.FC = () => {
  const { currentUser, isMuted, toggleMute } = useStore();
  const [mounted, setMounted] = useState(false);
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);

  const [activeStoryGroup, setActiveStoryGroup] = useState<UserStoryGroup | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  // Upload story state (supports batch multi-story upload)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [storyMediaFiles, setStoryMediaFiles] = useState<Array<{ url: string; type: 'IMAGE' | 'VIDEO' }>>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [newStoryCaption, setNewStoryCaption] = useState('');
  const [storyMusic, setStoryMusic] = useState<SelectedSong | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 👁 Story Viewers List
  const [showViewersList, setShowViewersList] = useState(false);
  const [viewersList, setViewersList] = useState<any[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // 🗑️ Centered Delete Confirmation Modal State
  const [storyToDelete, setStoryToDelete] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const storyAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 🔇 Keep story audio synced with global mute state
  useEffect(() => {
    if (storyAudioRef.current) {
      storyAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    setMounted(true);
    loadStories();
  }, []);

  const loadStories = async () => {
    setLoadingStories(true);
    try {
      const res = await api.get('/stories');
      if (res.success && Array.isArray(res.data)) {
        const formatted: UserStoryGroup[] = res.data.map((item: any) => ({
          userId: item.user.id,
          username: item.user.username,
          displayName: item.user.displayName,
          avatarUrl: item.user.avatarUrl || '',
          hasUnseen: item.hasUnseen || false,
          stories: item.stories || [],
        }));
        setStoryGroups(formatted);
      } else {
        setStoryGroups([]);
      }
    } catch (err) {
      setStoryGroups([]);
    } finally {
      setLoadingStories(false);
    }
  };

  const openStory = async (group: UserStoryGroup) => {
    setActiveStoryGroup(group);
    setCurrentStoryIndex(0);
    const story = group.stories[0];
    if (story) {
      api.post(`/stories/${story.id}/view`).catch(() => {});
      if (story.musicUrl && storyAudioRef.current) {
        storyAudioRef.current.src = story.musicUrl;
        storyAudioRef.current.currentTime = story.musicStartSec || 0;
        storyAudioRef.current.play().catch(() => {});
      }
    }
  };


  const closeStory = () => {
    if (storyAudioRef.current) {
      storyAudioRef.current.pause();
    }
    setActiveStoryGroup(null);
    setShowViewersList(false);
    setViewersList([]);
    setStoryToDelete(null);
    setDeleteErrorMessage(null);
  };

  const goToPrevStory = () => {
    if (!activeStoryGroup) return;
    if (currentStoryIndex > 0) {
      const prevIdx = currentStoryIndex - 1;
      setCurrentStoryIndex(prevIdx);
      const story = activeStoryGroup.stories[prevIdx];
      if (story) {
        api.post(`/stories/${story.id}/view`).catch(() => {});
        if (story.musicUrl && storyAudioRef.current) {
          storyAudioRef.current.src = story.musicUrl;
          storyAudioRef.current.currentTime = story.musicStartSec || 0;
          storyAudioRef.current.play().catch(() => {});
        } else if (storyAudioRef.current) {
          storyAudioRef.current.pause();
        }
      }
    }
  };

  const goToNextStory = () => {
    if (!activeStoryGroup) return;
    if (currentStoryIndex < activeStoryGroup.stories.length - 1) {
      const nextIdx = currentStoryIndex + 1;
      setCurrentStoryIndex(nextIdx);
      const story = activeStoryGroup.stories[nextIdx];
      if (story) {
        api.post(`/stories/${story.id}/view`).catch(() => {});
        if (story.musicUrl && storyAudioRef.current) {
          storyAudioRef.current.src = story.musicUrl;
          storyAudioRef.current.currentTime = story.musicStartSec || 0;
          storyAudioRef.current.play().catch(() => {});
        } else if (storyAudioRef.current) {
          storyAudioRef.current.pause();
        }
      }
    } else {
      closeStory();
    }
  };

  const [isDeletingStory, setIsDeletingStory] = useState(false);

  // Opens the centered confirmation modal
  const promptDeleteStory = (storyId: string) => {
    setDeleteErrorMessage(null);
    setStoryToDelete(storyId);
  };

  // Performs actual delete via API
  const confirmDeleteStory = async () => {
    if (!storyToDelete) return;
    const storyId = storyToDelete;

    setIsDeletingStory(true);
    setDeleteErrorMessage(null);
    try {
      const res = await api.delete(`/stories/${storyId}`);
      if (res.success) {
        setStoryToDelete(null);
        if (activeStoryGroup) {
          const remainingStories = activeStoryGroup.stories.filter((s) => s.id !== storyId);
          if (remainingStories.length === 0) {
            closeStory();
          } else {
            const nextIndex =
              currentStoryIndex >= remainingStories.length
                ? Math.max(0, remainingStories.length - 1)
                : currentStoryIndex;
            setActiveStoryGroup({
              ...activeStoryGroup,
              stories: remainingStories,
            });
            setCurrentStoryIndex(nextIndex);
            const nextStory = remainingStories[nextIndex];
            if (nextStory?.musicUrl && storyAudioRef.current) {
              storyAudioRef.current.src = nextStory.musicUrl;
              storyAudioRef.current.currentTime = nextStory.musicStartSec || 0;
              storyAudioRef.current.play().catch(() => {});
            } else if (storyAudioRef.current) {
              storyAudioRef.current.pause();
            }
          }
        }
        loadStories();
      } else {
        setDeleteErrorMessage(res.message || 'Failed to delete story. Please try again.');
      }
    } catch {
      setDeleteErrorMessage('Could not connect to server to delete story.');
    } finally {
      setIsDeletingStory(false);
    }
  };

  // 👁 Fetch story viewers list
  const fetchStoryViewers = async (storyId: string) => {
    setShowViewersList(true);
    setLoadingViewers(true);
    try {
      const res = await api.get(`/stories/${storyId}/viewers`);
      if (res.success) {
        setViewersList(res.data || []);
      }
    } catch {
      setViewersList([]);
    } finally {
      setLoadingViewers(false);
    }
  };

  // ⏱️ Auto-advance timer for stories (paused when delete confirmation or viewers list is open)
  useEffect(() => {
    if (!activeStoryGroup || storyToDelete || showViewersList) return;
    const currentStory = activeStoryGroup.stories[currentStoryIndex];
    if (!currentStory) return;

    const isVideo = currentStory.mediaType === 'VIDEO' || isVideoUrl(currentStory.mediaUrl);
    if (!isVideo) {
      const timer = setTimeout(() => {
        goToNextStory();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [activeStoryGroup, currentStoryIndex, storyToDelete, showViewersList]);

  const [isUploadingStory, setIsUploadingStory] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingStory(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.upload('/upload', formData);
        if (res.success && res.url) {
          const isVideo =
            file.type.startsWith('video') ||
            /\.(mp4|webm|mov|mkv|avi|3gp|m4v|ogv|wmv|flv)$/i.test(file.name);
          return { url: res.url, type: isVideo ? ('VIDEO' as const) : ('IMAGE' as const) };
        }
        return null;
      });

      const uploadedResults = await Promise.all(uploadPromises);
      const validItems = uploadedResults.filter(
        (item): item is { url: string; type: 'IMAGE' | 'VIDEO' } => item !== null
      );

      if (validItems.length > 0) {
        setStoryMediaFiles((prev) => [...prev, ...validItems]);
        setShowUploadModal(true);
      } else {
        alert('File upload failed.');
      }
    } catch {
      alert('File processing failed.');
    } finally {
      setIsUploadingStory(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (storyMediaFiles.length === 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        items: storyMediaFiles.map((file) => ({
          mediaUrl: file.url,
          mediaType: file.type,
          caption: newStoryCaption.trim() || undefined,
          musicTitle: storyMusic?.title || undefined,
          musicArtist: storyMusic?.artist || undefined,
          musicUrl: storyMusic?.url || undefined,
          musicStartSec: storyMusic?.startSec !== undefined ? storyMusic.startSec : undefined,
          musicEndSec: storyMusic?.endSec !== undefined ? storyMusic.endSec : undefined,
        })),
      };

      const res = await api.post('/stories', payload);

      if (res.success) {
        const count = storyMediaFiles.length;
        alert(
          count > 1
            ? `🎉 ${count} Stories uploaded successfully! (Active for 24 hours)`
            : '🎉 Nuraiyan Story uploaded successfully! (Active for 24 hours)'
        );
        setShowUploadModal(false);
        setStoryMediaFiles([]);
        setActivePreviewIndex(0);
        setNewStoryCaption('');
        setStoryMusic(null);
        loadStories();
      } else {
        alert(res.message || 'Failed to upload story.');
      }
    } catch {
      alert('Server error: Could not upload story.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const allDisplayStories = storyGroups;

  return (
    <div className="w-full bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 shadow-xl border border-white/[0.08] mb-5 relative group/bar">
      {/* Hidden Audio Player */}
      <audio ref={storyAudioRef} loop />

      {/* Hidden File Input (Supports multi-select) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*"
        multiple
        className="hidden"
      />

      {/* Header Label */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <h3 className="text-xs font-bold tracking-wider text-slate-200 flex items-center gap-1.5 uppercase">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          <span>Stories</span>
        </h3>
        <span className="text-[11px] text-slate-400 font-medium">Expires in 24h</span>
      </div>

      {/* Scroll Navigation Arrows */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg border border-white/20 opacity-0 group-hover/bar:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg border border-white/20 opacity-0 group-hover/bar:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Horizontal Story Reel Cards */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none scroll-smooth"
      >
        {/* Card 1: Add Story Trigger */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="relative w-24 sm:w-28 h-36 sm:h-40 rounded-xl overflow-hidden flex-shrink-0 flex flex-col justify-between p-2.5 bg-gradient-to-b from-[#182032] to-[#0f1422] border border-white/[0.1] hover:border-indigo-500/50 transition-all hover:scale-[1.02] group focus:outline-none shadow-md cursor-pointer"
        >
          {currentUser?.avatarUrl && !currentUser.avatarUrl.includes('unsplash') && !currentUser.avatarUrl.includes('dicebear') && (
            <img
              src={resolveMediaUrl(currentUser.avatarUrl)}
              alt="My Story"
              className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:scale-105 transition-transform duration-300"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-transparent opacity-90" />

          {/* Top Plus Badge */}
          <div className="relative z-10 w-7 h-7 rounded-lg bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-500/30 group-hover:scale-110 transition-transform">
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          </div>

          {/* Bottom Label */}
          <div className="relative z-10 text-left">
            <span className="block text-xs font-bold text-white group-hover:text-rose-300 transition-colors leading-none">
              Add Story
            </span>
            <span className="block text-[9px] text-slate-400 font-medium leading-none mt-1">
              Share moment
            </span>
          </div>
        </button>

        {/* Stories from Real Friends */}
        {allDisplayStories.map((group) => {
          const firstStory = group.stories[0];
          const bgThumbnail = firstStory?.mediaUrl || group.avatarUrl;

          return (
            <button
              key={group.userId}
              onClick={() => openStory(group)}
              className="relative w-24 sm:w-28 h-36 sm:h-40 rounded-xl overflow-hidden flex-shrink-0 flex flex-col justify-between p-2 border border-white/[0.08] hover:border-white/[0.25] transition-all hover:scale-[1.02] group focus:outline-none shadow-md cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20 z-10" />

              {bgThumbnail && !bgThumbnail.includes('dicebear') && (
                <img
                  src={resolveMediaUrl(bgThumbnail)}
                  alt={group.displayName}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}

              {/* Author Avatar at Top */}
              <div className="relative z-20">
                <div className={`p-0.5 rounded-full inline-block ${group.hasUnseen ? 'story-ring-gradient shadow-md shadow-rose-500/20' : 'bg-white/30'}`}>
                  <UserAvatar
                    avatarUrl={group.avatarUrl}
                    name={group.displayName}
                    username={group.username}
                    size="sm"
                  />
                </div>
              </div>

              {/* Bottom Info */}
              <div className="relative z-20 text-left">
                <span className="block text-xs font-bold text-white truncate drop-shadow-md">
                  {group.displayName}
                </span>
                {firstStory?.musicTitle && (
                  <span className="flex items-center gap-1 text-[9px] text-rose-300 font-medium truncate mt-0.5">
                    <Music className="w-2.5 h-2.5 animate-pulse" />
                    <span className="truncate">{firstStory.musicTitle}</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Upload Story Modal (Portaled directly to document.body to prevent stacking context merging) */}
      {mounted && showUploadModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#111726]/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-white/[0.1] text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div>
                <h3 className="font-bold text-white text-base">Upload New Story</h3>
                <p className="text-xs text-slate-400">Stories automatically disappear after 24 hours</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStory} className="flex flex-col gap-4">
              {/* Photo/Video Picker (Single or Multi-item Batch) */}
              <div>
                {storyMediaFiles.length > 0 ? (
                  <div className="space-y-3">
                    {/* Main Featured Preview */}
                    <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] aspect-[9/16] max-h-64 bg-black flex items-center justify-center">
                      {storyMediaFiles[activePreviewIndex]?.type === 'VIDEO' || isVideoUrl(storyMediaFiles[activePreviewIndex]?.url) ? (
                        <video
                          src={resolveMediaUrl(storyMediaFiles[activePreviewIndex]?.url)}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img
                          src={resolveMediaUrl(storyMediaFiles[activePreviewIndex]?.url)}
                          alt="Story preview"
                          className="w-full h-full object-contain"
                        />
                      )}

                      {/* Remove current item */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = storyMediaFiles.filter((_, idx) => idx !== activePreviewIndex);
                          setStoryMediaFiles(updated);
                          if (activePreviewIndex >= updated.length) {
                            setActivePreviewIndex(Math.max(0, updated.length - 1));
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-full transition-colors cursor-pointer"
                        title="Remove this photo/video"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* Index badge */}
                      <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg text-white text-[10px] font-bold border border-white/10">
                        Story {activePreviewIndex + 1} of {storyMediaFiles.length}
                      </div>
                    </div>

                    {/* Horizontal Multi-item Thumbnail Strip */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {storyMediaFiles.map((file, idx) => (
                        <div
                          key={idx}
                          onClick={() => setActivePreviewIndex(idx)}
                          className={`relative w-14 h-18 rounded-xl overflow-hidden shrink-0 border cursor-pointer transition-all ${
                            idx === activePreviewIndex
                              ? 'border-rose-500 ring-2 ring-rose-500/50 scale-105'
                              : 'border-white/10 opacity-70 hover:opacity-100'
                          }`}
                        >
                          {file.type === 'VIDEO' || isVideoUrl(file.url) ? (
                            <video src={resolveMediaUrl(file.url)} className="w-full h-full object-cover" />
                          ) : (
                            <img src={resolveMediaUrl(file.url)} alt={`Story ${idx + 1}`} className="w-full h-full object-cover" />
                          )}
                          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}

                      {/* "+ Add More" Button in strip */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingStory}
                        className="w-14 h-18 rounded-xl border-2 border-dashed border-white/20 hover:border-rose-500/50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white shrink-0 bg-white/[0.02] cursor-pointer transition-colors"
                        title="Add more photos or videos"
                      >
                        <Plus className="w-4 h-4 text-rose-400" />
                        <span className="text-[9px] font-bold">Add more</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingStory}
                    className="w-full h-40 border-2 border-dashed border-white/[0.15] hover:border-rose-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors bg-white/[0.02] cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-rose-400">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold">
                      {isUploadingStory ? 'Uploading files...' : 'Select Photos or Videos'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Supports JPG, PNG, MP4, WebM, MOV • একাধিক ছবি বা ভিডিও সিলেক্ট করতে পারবেন
                    </span>
                  </button>
                )}
              </div>

              {/* Music Picker Integration */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Background Music (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setShowMusicPicker(!showMusicPicker)}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                  >
                    {storyMusic ? 'Change Song' : '+ Add Music'}
                  </button>
                </div>

                {storyMusic && (
                  <div className="mt-2 p-3 bg-white/[0.05] rounded-xl border border-white/[0.1] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-rose-400" />
                      <div>
                        <p className="text-xs font-semibold text-white">{storyMusic.title}</p>
                        <p className="text-[10px] text-slate-400">{storyMusic.artist}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStoryMusic(null)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {showMusicPicker && (
                  <div
                    className="mt-2"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <MusicPicker
                      selectedSong={storyMusic}
                      onSelectSong={(song) => {
                        setStoryMusic(song);
                        setShowMusicPicker(false);
                      }}
                      onClose={() => setShowMusicPicker(false)}
                    />
                  </div>
                )}
              </div>

              <div>
                <input
                  type="text"
                  maxLength={150}
                  value={newStoryCaption}
                  onChange={(e) => setNewStoryCaption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  placeholder="Write a caption..."
                  className="w-full text-xs p-3 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={storyMediaFiles.length === 0 || isSubmitting || isUploadingStory}
                  className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-rose-500 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
                >
                  {isSubmitting
                    ? 'Uploading...'
                    : storyMediaFiles.length > 1
                    ? `Share ${storyMediaFiles.length} Stories`
                    : 'Share Story'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Fullscreen Story Viewer Modal (Portaled to document.body) */}
      {mounted && activeStoryGroup && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-0 sm:p-6">
          <div className="relative w-full max-w-sm h-full sm:h-[640px] bg-slate-950 sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border border-white/10">
            {/* Story Segment Progress Bars */}
            <div className="absolute top-2.5 left-3 right-3 z-40 flex items-center gap-1">
              {activeStoryGroup.stories.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    idx === currentStoryIndex
                      ? 'bg-white'
                      : idx < currentStoryIndex
                      ? 'bg-white/80'
                      : 'bg-white/25'
                  }`}
                />
              ))}
            </div>

            {/* Top Controls: Mute, Delete (for owner), & Close */}
            <div className="absolute top-5 right-3.5 z-40 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer transition-colors border border-white/20"
                title={isMuted ? 'Unmute Story' : 'Mute Story'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
              </button>

              {/* 🗑️ Story Delete Option (Available when viewing own story) */}
              {activeStoryGroup.userId === currentUser?.id && (
                <button
                  type="button"
                  disabled={isDeletingStory}
                  onClick={() => {
                    const currentStory = activeStoryGroup.stories[currentStoryIndex];
                    if (currentStory) {
                      promptDeleteStory(currentStory.id);
                    }
                  }}
                  className="p-2 bg-red-600/80 hover:bg-red-600 rounded-full text-white cursor-pointer transition-all border border-red-500/40 shadow-lg disabled:opacity-50"
                  title="Delete Story (স্টোরি মুছুন)"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}

              <button
                type="button"
                onClick={closeStory}
                className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer transition-colors border border-white/20"
                title="Close Story"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Header */}
            <div className="absolute top-6 left-3.5 right-28 z-30 flex items-center gap-2.5">
              <UserAvatar
                avatarUrl={activeStoryGroup.avatarUrl}
                name={activeStoryGroup.displayName}
                username={activeStoryGroup.username}
                size="md"
                className="ring-2 ring-rose-500"
              />
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-bold leading-tight truncate">
                  {activeStoryGroup.displayName}
                </p>
                {activeStoryGroup.stories[currentStoryIndex]?.musicTitle ? (
                  <p className="text-rose-300 text-[10px] flex items-center gap-1 mt-0.5 truncate">
                    <Music className="w-2.5 h-2.5 animate-pulse shrink-0" />
                    <span className="truncate">{activeStoryGroup.stories[currentStoryIndex].musicTitle}</span>
                  </p>
                ) : (
                  <p className="text-white/60 text-[10px]">24-Hour Story</p>
                )}
              </div>
            </div>

            {/* Story Navigation Tap Zones */}
            <div
              onClick={goToPrevStory}
              className="absolute left-0 top-16 bottom-20 w-1/3 z-20 cursor-pointer"
              title="Previous"
            />
            <div
              onClick={goToNextStory}
              className="absolute right-0 top-16 bottom-20 w-1/3 z-20 cursor-pointer"
              title="Next"
            />

            {/* Navigation Arrows for desktop */}
            {currentStoryIndex > 0 && (
              <button
                type="button"
                onClick={goToPrevStory}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 cursor-pointer"
                title="Previous Story"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {currentStoryIndex < activeStoryGroup.stories.length - 1 && (
              <button
                type="button"
                onClick={goToNextStory}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 cursor-pointer"
                title="Next Story"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Media Content */}
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {activeStoryGroup.stories[currentStoryIndex]?.mediaType === 'VIDEO' || isVideoUrl(activeStoryGroup.stories[currentStoryIndex]?.mediaUrl) ? (
                <video
                  src={resolveMediaUrl(activeStoryGroup.stories[currentStoryIndex]?.mediaUrl)}
                  autoPlay
                  playsInline
                  preload="metadata"
                  muted={isMuted}
                  onEnded={goToNextStory}
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={resolveMediaUrl(activeStoryGroup.stories[currentStoryIndex]?.mediaUrl)}
                  alt="Story"
                  className="w-full h-full object-contain"
                />
              )}

              {/* Caption Overlay */}
              {activeStoryGroup.stories[currentStoryIndex]?.caption && (
                <div className="absolute bottom-16 left-4 right-4 bg-black/70 backdrop-blur-md p-3.5 rounded-2xl text-center border border-white/10 z-25">
                  <p className="text-white text-xs font-medium leading-relaxed">
                    {activeStoryGroup.stories[currentStoryIndex].caption}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Controls: Views & Delete for Owner, Quick Reply for Others */}
            {activeStoryGroup.userId === currentUser?.id ? (
              <>
                {/* Viewers List Panel */}
                {showViewersList && (
                  <div className="absolute inset-0 z-40 flex items-end" onClick={() => setShowViewersList(false)}>
                    <div
                      className="w-full max-h-[60%] bg-gray-900/95 backdrop-blur-xl rounded-t-3xl border-t border-white/15 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Panel Header */}
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <Users className="w-4.5 h-4.5 text-rose-400" />
                          <span className="text-white text-sm font-bold">
                            Viewed by {viewersList.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowViewersList(false)}
                          className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Viewers List */}
                      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                        {loadingViewers ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : viewersList.length === 0 ? (
                          <div className="text-center py-8 text-white/50 text-xs">
                            No one has viewed this story yet
                          </div>
                        ) : (
                          viewersList.map((view: any) => (
                            <div
                              key={view.id || view.viewerId}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                            >
                              {/* Avatar */}
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 ring-2 ring-white/10">
                                {view.viewer?.avatarUrl ? (
                                  <img
                                    src={resolveMediaUrl(view.viewer.avatarUrl)}
                                    alt={view.viewer.displayName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{(view.viewer?.displayName || '?')[0].toUpperCase()}</span>
                                )}
                              </div>
                              {/* Name & Username */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-semibold truncate">
                                  {view.viewer?.displayName || 'Unknown'}
                                </p>
                                <p className="text-white/50 text-[10px] truncate">
                                  @{view.viewer?.username || 'user'}
                                </p>
                              </div>
                              {/* Timestamp */}
                              <span className="text-white/40 text-[10px] shrink-0">
                                {view.createdAt
                                  ? (() => {
                                      const diff = Date.now() - new Date(view.createdAt).getTime();
                                      const mins = Math.floor(diff / 60000);
                                      if (mins < 1) return 'just now';
                                      if (mins < 60) return `${mins}m ago`;
                                      const hrs = Math.floor(mins / 60);
                                      if (hrs < 24) return `${hrs}h ago`;
                                      return `${Math.floor(hrs / 24)}d ago`;
                                    })()
                                  : ''}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Bar */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3.5 py-2.5 bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 z-30 shadow-xl gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const currentStory = activeStoryGroup.stories[currentStoryIndex];
                    if (currentStory) fetchStoryViewers(currentStory.id);
                  }}
                  className="flex items-center gap-1.5 text-white text-xs font-bold shrink-0 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  title="Click to see who viewed"
                >
                  <Eye className="w-4 h-4 text-rose-400" />
                  <span>
                    {activeStoryGroup.stories[currentStoryIndex]?.viewsCount || 0}{' '}
                    {(activeStoryGroup.stories[currentStoryIndex]?.viewsCount || 0) === 1 ? 'view' : 'views'}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeStory();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer border border-white/10"
                    title="Add another story"
                  >
                    <Plus className="w-3.5 h-3.5 text-rose-400" />
                    <span>Add Story</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingStory}
                    onClick={() => {
                      const currentStory = activeStoryGroup.stories[currentStoryIndex];
                      if (currentStory) {
                        promptDeleteStory(currentStory.id);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeletingStory ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </div>
              </>
            ) : (
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 z-30">
                <input
                  type="text"
                  placeholder={`Send message to ${activeStoryGroup.displayName}...`}
                  className="flex-1 bg-white/15 text-white placeholder-white/60 text-xs px-4 py-2.5 rounded-full border border-white/20 focus:outline-none focus:bg-white/25"
                />
                <button
                  type="button"
                  onClick={() => alert('Love reaction sent! ❤️')}
                  className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-colors cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-white" />
                </button>
              </div>
            )}

            {/* 🗑️ Centered Story Delete Confirmation Modal */}
            {storyToDelete && (
              <div
                className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDeletingStory) setStoryToDelete(null);
                }}
              >
                <div
                  className="w-full max-w-[310px] bg-slate-900/95 border border-white/15 rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mb-3 shadow-lg shadow-red-500/10">
                    <Trash2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-white text-base font-extrabold mb-1">
                    Delete Story?
                  </h4>
                  <p className="text-slate-300 text-xs leading-relaxed mb-4">
                    আপনি কি এই স্টোরিটি ডিলিট করতে চান? এটি সাথে সাথে মুছে যাবে।
                  </p>

                  {deleteErrorMessage && (
                    <div className="w-full mb-3 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-[11px]">
                      {deleteErrorMessage}
                    </div>
                  )}

                  <div className="w-full flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDeletingStory}
                      onClick={() => setStoryToDelete(null)}
                      className="flex-1 py-2.5 px-3 bg-white/10 hover:bg-white/15 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer border border-white/10 disabled:opacity-50"
                    >
                      Cancel (বাতিল)
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingStory}
                      onClick={confirmDeleteStory}
                      className="flex-1 py-2.5 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isDeletingStory ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <span>Delete (মুছুন)</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
