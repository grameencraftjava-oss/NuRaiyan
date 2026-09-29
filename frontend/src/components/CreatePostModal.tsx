'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Video, Smile, Music, Volume2, Globe, Users, Lock, Loader2, Film } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MusicPicker, SelectedSong } from './MusicPicker';
import { api, resolveMediaUrl } from '../lib/api';
import { UserAvatar } from './UserAvatar';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (newPost: any) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const { currentUser } = useStore();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: 'IMAGE' | 'VIDEO' }[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<SelectedSong | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'FRIENDS' | 'ONLY_ME'>('PUBLIC');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage('');
    setUploadProgress(0);

    try {
      const fileList = Array.from(files);
      for (const file of fileList) {
        setUploadingFileName(file.name);
        const formData = new FormData();
        formData.append('file', file);

        const res = await api.uploadWithProgress('/upload', formData, (percent) => {
          setUploadProgress(percent);
        });

        const fileUrl = res.url || res.data?.url;
        if (res.success && fileUrl) {
          const isVideo =
            file.type.startsWith('video') ||
            /\.(mp4|webm|mov|mkv|avi|3gp|m4v|ogv|wmv|flv)$/i.test(file.name);
          setMediaFiles((prev) => [
            ...prev,
            {
              url: fileUrl,
              type: isVideo ? 'VIDEO' : 'IMAGE',
            },
          ]);
        } else {
          setErrorMessage(res.message || 'File upload failed. Please try a smaller video or check network.');
        }
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setErrorMessage(err?.message || 'File processing error. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setUploadingFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0) return;
    if (isUploading) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const isAnyVideo = mediaFiles.some((m) => m.type === 'VIDEO');
    const payload = {
      content: content.trim() || undefined,
      mediaUrls: mediaFiles.map((m) => m.url),
      mediaType: isAnyVideo ? 'VIDEO' : mediaFiles.length > 0 ? mediaFiles[0].type : undefined,
      privacy,
      musicTitle: selectedMusic?.title || undefined,
      musicArtist: selectedMusic?.artist || undefined,
      musicUrl: selectedMusic?.url || undefined,
      musicStartSec: selectedMusic?.startSec !== undefined ? selectedMusic.startSec : undefined,
      musicEndSec: selectedMusic?.endSec !== undefined ? selectedMusic.endSec : undefined,
    };

    try {
      const res = await api.post('/posts', payload);
      if (res.success && res.data) {
        if (onPostCreated) onPostCreated(res.data);
        setContent('');
        setMediaFiles([]);
        setSelectedMusic(null);
        onClose();
      } else {
        setErrorMessage(res.message || 'Could not publish post.');
      }
    } catch (err: any) {
      setErrorMessage('Server error: Failed to create post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#111726]/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/[0.1] text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*"
          multiple
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <h3 className="font-bold text-base text-white">Create New Post</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* User Info & Privacy selector */}
          <div className="flex items-center gap-3 mb-4">
            <UserAvatar
              avatarUrl={currentUser?.avatarUrl}
              name={currentUser?.displayName}
              username={currentUser?.username}
              size="lg"
              className="ring-2 ring-indigo-500/30"
            />
            <div>
              <p className="font-bold text-white text-sm">
                {currentUser?.displayName || 'Nuraiyan Member'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <select
                  value={privacy}
                  onChange={(e: any) => setPrivacy(e.target.value)}
                  className="text-xs bg-white/[0.06] text-slate-300 font-medium px-2.5 py-1 rounded-lg border border-white/[0.1] focus:ring-1 focus:ring-rose-500 outline-none cursor-pointer"
                >
                  <option value="PUBLIC" className="bg-[#111726] text-white">🌍 Public</option>
                  <option value="FRIENDS" className="bg-[#111726] text-white">👥 Friends</option>
                  <option value="ONLY_ME" className="bg-[#111726] text-white">🔒 Only Me</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl font-medium text-center">
              {errorMessage}
            </div>
          )}

          {/* Text Area */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a story, memory, or thoughts with the community..."
            rows={4}
            className="w-full text-white placeholder-slate-400 bg-transparent border-none resize-none focus:outline-none text-sm sm:text-base leading-relaxed"
          />

          {/* Selected Music Badge */}
          {selectedMusic && (
            <div className="my-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-rose-400 animate-pulse" />
                <div>
                  <span className="text-xs font-bold text-white">{selectedMusic.title}</span>
                  <span className="text-[11px] text-rose-300 ml-1.5">• {selectedMusic.artist}</span>
                  {selectedMusic.startSec !== undefined && selectedMusic.endSec !== undefined && (
                    <span className="text-[10px] text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full ml-2 font-mono font-bold">
                      ✂️ {Math.floor(selectedMusic.startSec / 60)}:{(selectedMusic.startSec % 60).toString().padStart(2, '0')} - {Math.floor(selectedMusic.endSec / 60)}:{(selectedMusic.endSec % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>

              </div>
              <button
                type="button"
                onClick={() => setSelectedMusic(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Upload Progress Indicator */}
          {isUploading && (
            <div className="my-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Loader2 className="w-4 h-4 text-rose-400 animate-spin flex-shrink-0" />
                  <span className="font-semibold text-white truncate">
                    Uploading {uploadingFileName || 'media'}...
                  </span>
                </div>
                <span className="font-mono font-bold text-rose-300 ml-2">
                  {uploadProgress !== null ? `${uploadProgress}%` : 'Processing...'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-indigo-500 transition-all duration-200 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, uploadProgress || 0))}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Large video files are being uploaded and processed safely...
              </p>
            </div>
          )}

          {/* Media Previews (Photo & Video) */}
          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3 mb-2">
              {mediaFiles.map((media, idx) => (
                <div key={idx} className="relative rounded-2xl overflow-hidden border border-white/[0.1] aspect-video bg-black/60">
                  {media.type === 'VIDEO' ? (
                    <video
                      src={resolveMediaUrl(media.url)}
                      controls
                      preload="metadata"
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <img src={resolveMediaUrl(media.url)} alt="Uploaded" className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(idx)}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 rounded-full text-white cursor-pointer z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Music Picker Drawer / Toggle */}
          {showMusicPicker && (
            <div className="my-3">
              <MusicPicker
                selectedSong={selectedMusic}
                onSelectSong={(song) => {
                  setSelectedMusic(song);
                  setShowMusicPicker(false);
                }}
                onClose={() => setShowMusicPicker(false)}
              />
            </div>
          )}

          {/* Add Media Toolbar */}
          <div className="mt-4 p-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Add to your post:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Upload Photo or Video"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Photo/Video</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMusicPicker(!showMusicPicker)}
                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Add Background Music"
              >
                <Music className="w-4 h-4" />
                <span className="hidden sm:inline">Music</span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={(!content.trim() && mediaFiles.length === 0) || isSubmitting || isUploading}
            className="w-full mt-4 py-3 bg-gradient-to-r from-rose-500 via-rose-600 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 disabled:opacity-40 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing Post...</span>
              </>
            ) : isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading Video ({uploadProgress !== null ? `${uploadProgress}%` : '...'})</span>
              </>
            ) : (
              <span>Post to Community</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
