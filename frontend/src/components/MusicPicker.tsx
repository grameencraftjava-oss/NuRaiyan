'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Search,
  Play,
  Pause,
  Check,
  Volume2,
  X,
  Upload,
  Sparkles,
  Disc3,
  Radio,
  Flame,
  Scissors,
  Clock,
} from 'lucide-react';
import { api, resolveMediaUrl } from '../lib/api';

export interface SelectedSong {
  id?: string;
  title: string;
  artist: string;
  url: string;
  artworkUrl?: string;
  duration?: number;
  startSec?: number;
  endSec?: number;
  isFullTrack?: boolean;
}

interface MusicPickerProps {
  onSelectSong: (song: SelectedSong | null) => void;
  selectedSong: SelectedSong | null;
  onClose?: () => void;
}

const GENRES = [
  { id: 'TRENDING', name: '🔥 Trending Hits', query: 'billboard top hits 2024' },
  { id: 'BANGLA', name: '🇧🇩 Bangla Hits', query: 'Tahsan' },
  { id: 'BOLLYWOOD', name: '🎬 Bollywood', query: 'arijit singh' },
  { id: 'POP', name: '✨ Pop & Viral', query: 'top viral pop hits' },
  { id: 'LOFI', name: '☕ Lo-Fi Chill', query: 'lofi hip hop chill beats' },
  { id: 'ISLAMIC', name: '🌙 Nasheed & Calm', query: 'maher zain sami yusuf nasheed' },
  { id: 'HIPHOP', name: '🎤 Hip-Hop & Rap', query: 'global hip hop hits' },
  { id: 'ROCK', name: '⚡ Rock & Indie', query: 'alternative indie rock' },
];

// Helper to fetch full-length unrestricted tracks from open community archives
async function fetchArchiveFullTracksClient(term: string): Promise<SelectedSong[]> {
  try {
    const q = encodeURIComponent(term.trim());
    const res = await fetch(
      `https://archive.org/advancedsearch.php?q=${q}+AND+mediatype:audio&fl[]=identifier,title,creator,description&output=json&rows=8`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data?.response?.docs;
    if (!Array.isArray(docs) || docs.length === 0) return [];

    const results: SelectedSong[] = [];

    for (const doc of docs.slice(0, 2)) {
      try {
        const metaRes = await fetch(`https://archive.org/metadata/${doc.identifier}`);
        if (!metaRes.ok) continue;
        const meta = await metaRes.json();
        const files: any[] = meta.files || [];
        const audioFiles = files.filter(
          (f) =>
            (f.format === 'MPEG-4 Audio' || f.format === 'VBR MP3' || f.name.endsWith('.mp3') || f.name.endsWith('.m4a')) &&
            !f.name.includes('_thumb')
        );

        for (const file of audioFiles.slice(0, 5)) {
          const duration = file.length ? Math.round(parseFloat(file.length)) : 240;
          const cleanTitle = file.title || file.name.replace(/\.[^/.]+$/, '').replace(/ - /g, ' • ');
          const directUrl = `https://archive.org/download/${doc.identifier}/${encodeURIComponent(file.name)}`;

          results.push({
            id: `ia_${doc.identifier}_${encodeURIComponent(file.name)}`,
            title: cleanTitle,
            artist: file.creator || doc.creator || 'Full Master Track',
            url: directUrl,
            artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
            duration: duration,
            startSec: 0,
            endSec: Math.min(30, duration),
            isFullTrack: true,
          });
        }
      } catch {
        continue;
      }
    }

    return results;
  } catch {
    return [];
  }
}

async function fetchItunesTracksClient(term: string, limit = 40): Promise<SelectedSong[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];
    return data.results
      .filter((r: any) => r.previewUrl && r.trackName)
      .map((r: any) => ({
        id: String(r.trackId),
        title: r.trackName,
        artist: r.artistName,
        url: r.previewUrl,
        artworkUrl: (r.artworkUrl100 || r.artworkUrl60 || '').replace('100x100bb', '600x600bb').replace('60x60bb', '600x600bb'),
        // Apple iTunes preview URLs are 30-second studio clips
        duration: 30,
        startSec: 0,
        endSec: 30,
        isFullTrack: false,
      }));
  } catch {
    return [];
  }
}

export const MusicPicker: React.FC<MusicPickerProps> = ({
  onSelectSong,
  selectedSong,
  onClose,
}) => {
  const [activeGenre, setActiveGenre] = useState('TRENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [songs, setSongs] = useState<SelectedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  // ✂️ Facebook / Instagram Clip Segment Selector State
  const [editingSong, setEditingSong] = useState<SelectedSong | null>(null);
  const [actualDuration, setActualDuration] = useState<number>(30);
  const [clipStartSec, setClipStartSec] = useState(0);
  const [clipDuration, setClipDuration] = useState<15 | 30>(30);
  const [isPlayingClip, setIsPlayingClip] = useState(false);

  // Custom upload & direct link state
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [customAudioUrl, setCustomAudioUrl] = useState('');
  const [isUploadingCustomAudio, setIsUploadingCustomAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clipIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      loadGenreSongs(activeGenre);
    }
  }, [activeGenre]);

  const loadGenreSongs = async (genreId: string) => {
    setLoading(true);
    try {
      const genreObj = GENRES.find((g) => g.id === genreId);
      const query = genreObj?.query || 'top hits';

      const res = await api.get(`/music/trending?genre=${genreId}`);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setSongs(res.data);
      } else {
        const clientResults = await fetchItunesTracksClient(query, 35);
        setSongs(clientResults);
      }
    } catch {
      const genreObj = GENRES.find((g) => g.id === genreId);
      const clientResults = await fetchItunesTracksClient(genreObj?.query || 'top hits', 35);
      setSongs(clientResults);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val.trim()) {
      loadGenreSongs(activeGenre);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Query backend music search first (supports smart Bangla transliteration and parallel queries)
        const res = await api.get(`/music/search?q=${encodeURIComponent(val)}`);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setSongs(res.data);
        } else {
          // Client-side fallback to direct iTunes
          const clientResults = await fetchItunesTracksClient(val, 35);
          setSongs(clientResults);
        }
      } catch {
        const clientResults = await fetchItunesTracksClient(val, 35);
        setSongs(clientResults);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const togglePlay = (url: string) => {
    const resolved = resolveMediaUrl(url);

    if (playingUrl === resolved) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingUrl(null);
    } else {
      if (clipAudioRef.current) {
        clipAudioRef.current.pause();
        setIsPlayingClip(false);
      }
      if (audioRef.current) {
        audioRef.current.src = resolved;
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .then(() => setPlayingUrl(resolved))
          .catch((err) => {
            console.warn('[Audio Play Notice]', err);
            // Some browsers require explicit user gesture or different source
            setPlayingUrl(null);
          });
      }
    }
  };

  const handleLoadedClipMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const d = e.currentTarget.duration;
    if (d && !isNaN(d) && isFinite(d) && d > 0) {
      const rounded = Math.round(d);
      setActualDuration(rounded);
      setClipStartSec((prev) => Math.min(prev, Math.max(0, rounded - clipDuration)));
    }
  };

  const handleOpenTrimmer = (song: SelectedSong) => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingUrl(null);
    }
    const initialDur = song.duration || 30;
    setActualDuration(initialDur);
    setEditingSong(song);
    const defaultStart = Math.min(song.startSec || 0, Math.max(0, initialDur - 30));
    setClipStartSec(defaultStart);
    setClipDuration((song.endSec && song.startSec && song.endSec - song.startSec === 15) ? 15 : 30);
    setIsPlayingClip(false);

    if (clipAudioRef.current) {
      clipAudioRef.current.src = resolveMediaUrl(song.url);
      clipAudioRef.current.currentTime = defaultStart;
    }
  };

  const togglePlayClip = () => {
    if (!clipAudioRef.current || !editingSong) return;

    if (isPlayingClip) {
      clipAudioRef.current.pause();
      setIsPlayingClip(false);
      if (clipIntervalRef.current) clearInterval(clipIntervalRef.current);
    } else {
      const resolved = resolveMediaUrl(editingSong.url);
      if (clipAudioRef.current.src !== resolved) {
        clipAudioRef.current.src = resolved;
      }
      clipAudioRef.current.currentTime = clipStartSec;
      clipAudioRef.current
        .play()
        .then(() => {
          setIsPlayingClip(true);
          const stopTime = clipStartSec + clipDuration;

          if (clipIntervalRef.current) clearInterval(clipIntervalRef.current);
          clipIntervalRef.current = setInterval(() => {
            if (clipAudioRef.current) {
              if (clipAudioRef.current.currentTime >= stopTime || clipAudioRef.current.ended) {
                clipAudioRef.current.currentTime = clipStartSec;
              }
            }
          }, 200);
        })
        .catch(() => setIsPlayingClip(false));
    }
  };

  const handleConfirmClip = () => {
    if (!editingSong) return;
    if (clipAudioRef.current) {
      clipAudioRef.current.pause();
      setIsPlayingClip(false);
    }
    if (clipIntervalRef.current) clearInterval(clipIntervalRef.current);

    const songWithClip: SelectedSong = {
      ...editingSong,
      duration: actualDuration,
      startSec: clipStartSec,
      endSec: Math.min(actualDuration, clipStartSec + clipDuration),
    };
    onSelectSong(songWithClip);
    setEditingSong(null);
  };

  const handleQuickSelect = (song: SelectedSong) => {
    if (selectedSong?.url === song.url || (selectedSong?.title === song.title && selectedSong?.artist === song.artist)) {
      onSelectSong(null);
    } else {
      const songWithClip: SelectedSong = {
        ...song,
        duration: song.duration || 30,
        startSec: 0,
        endSec: Math.min(30, song.duration || 30),
      };
      onSelectSong(songWithClip);
    }
  };

  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCustomAudio(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload('/upload', formData);
      if (res.success && res.url) {
        const title = customTitle.trim() || file.name.replace(/\.[^/.]+$/, '');
        const artist = customArtist.trim() || 'Custom Upload';
        const newSong: SelectedSong = {
          title,
          artist,
          url: res.url,
          duration: 300,
          startSec: 0,
          endSec: 30,
          isFullTrack: true,
        };
        setShowCustomInput(false);
        handleOpenTrimmer(newSong);
      } else {
        alert(res.message || 'Audio file upload failed.');
      }
    } catch {
      alert('Audio upload processing failed.');
    } finally {
      setIsUploadingCustomAudio(false);
    }
  };

  const handleApplyCustomUrl = () => {
    if (!customAudioUrl.trim()) return;
    const song: SelectedSong = {
      title: customTitle.trim() || 'Audio Link',
      artist: customArtist.trim() || 'Web Audio',
      url: customAudioUrl.trim(),
      duration: 300,
      startSec: 0,
      endSec: 30,
      isFullTrack: true,
    };
    setShowCustomInput(false);
    handleOpenTrimmer(song);
  };

  return (
    <div className="bg-[#111726] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[580px] animate-in fade-in zoom-in-95 text-slate-100">
      <audio
        ref={audioRef}
        onEnded={() => setPlayingUrl(null)}
        onError={() => setPlayingUrl(null)}
      />
      <audio
        ref={clipAudioRef}
        onLoadedMetadata={handleLoadedClipMetadata}
        onEnded={() => {
          if (clipAudioRef.current) {
            clipAudioRef.current.currentTime = clipStartSec;
            clipAudioRef.current.play().catch(() => {});
          }
        }}
        onError={() => setIsPlayingClip(false)}
      />

      <input
        type="file"
        ref={fileUploadRef}
        onChange={handleCustomFileUpload}
        accept="audio/*"
        className="hidden"
      />

      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span>Soundtracks &amp; Music</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-semibold">
                FB / Insta Style
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Pick any song &amp; customize the exact 15s or 30s clip for your story or post
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ✂️ FACEBOOK / INSTAGRAM CLIP SELECTOR DRAWER */}
      {editingSong && (
        <div className="p-4 bg-gradient-to-r from-rose-950/40 via-[#182032] to-indigo-950/40 border-b border-rose-500/30 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Scissors className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="truncate">
                <span className="text-xs font-bold text-white block truncate">{editingSong.title}</span>
                <span className="text-[10px] text-rose-300 truncate">{editingSong.artist}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (clipAudioRef.current) clipAudioRef.current.pause();
                setIsPlayingClip(false);
                setEditingSong(null);
              }}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-3 bg-black/40 p-3 rounded-2xl border border-white/[0.08]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-rose-300 font-mono font-bold text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {Math.floor(clipStartSec / 60)}:{(clipStartSec % 60).toString().padStart(2, '0')} -{' '}
                  {Math.floor((clipStartSec + clipDuration) / 60)}:
                  {((clipStartSec + clipDuration) % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">({clipDuration}s clip)</span>
              </div>

              <div className="flex items-center gap-1 bg-white/[0.08] p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setClipDuration(15)}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    clipDuration === 15 ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  15s
                </button>
                <button
                  type="button"
                  onClick={() => setClipDuration(30)}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    clipDuration === 30 ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  30s
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="range"
                min={0}
                max={Math.max(0, actualDuration - clipDuration)}
                step={1}
                value={clipStartSec}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setClipStartSec(val);
                  if (clipAudioRef.current) {
                    clipAudioRef.current.currentTime = val;
                  }
                }}
                className="w-full accent-rose-500 h-1.5 bg-white/[0.1] rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
                <span>0:00</span>
                <span className="text-rose-300 font-sans font-medium text-[11px]">
                  {actualDuration > 35
                    ? `🎧 Full Track (${Math.floor(actualDuration / 60)}:${(actualDuration % 60).toString().padStart(2, '0')}) • Select Any Part`
                    : '✨ 30s Studio Preview • Select 15s or 30s snippet'}
                </span>
                <span>
                  {Math.floor(actualDuration / 60)}:{(actualDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={togglePlayClip}
                className="flex-1 py-2 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/[0.1]"
              >
                {isPlayingClip ? <Pause className="w-3.5 h-3.5 text-rose-400" /> : <Play className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />}
                <span>{isPlayingClip ? 'Pause Clip' : 'Preview Clip'}</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmClip}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-rose-500/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Attach Clip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="p-3 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Search millions of songs, artists, or soundtracks..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-rose-500/50 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSearchQuery('');
                loadGenreSongs(activeGenre);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Genre Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 scrollbar-none">
          {GENRES.map((g) => (
            <button
              type="button"
              key={g.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveGenre(g.id);
                setSearchQuery('');
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeGenre === g.id && !searchQuery
                  ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-sm'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {loading && (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
            <Disc3 className="w-6 h-6 animate-spin mx-auto text-rose-500" />
            <p>Searching global music catalog...</p>
          </div>
        )}

        {!loading && songs.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <Music className="w-8 h-8 mx-auto text-slate-600" />
            <p className="font-semibold text-slate-400">No tracks found</p>
            <p className="text-[11px]">Try searching another song title or artist name</p>
          </div>
        )}

        {!loading &&
          songs.map((song, idx) => {
            const isSelected =
              selectedSong?.url === song.url ||
              (selectedSong?.title === song.title && selectedSong?.artist === song.artist);
            const isPlaying = playingUrl === resolveMediaUrl(song.url);

            return (
              <div
                key={song.id || idx}
                className={`flex items-center justify-between p-2.5 rounded-2xl transition-all group ${
                  isSelected
                    ? 'bg-rose-500/15 border border-rose-500/30'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      togglePlay(song.url);
                    }}
                    className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white/[0.06] border border-white/[0.1] group-hover:border-rose-500/50 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                  >
                    {song.artworkUrl ? (
                      <img
                        src={song.artworkUrl}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-rose-500/30 to-indigo-500/30 flex items-center justify-center">
                        <Music className="w-4 h-4 text-rose-300" />
                      </div>
                    )}
                    <div
                      className={`absolute inset-0 flex items-center justify-center transition-all ${
                        isPlaying
                          ? 'bg-rose-600/60 opacity-100'
                          : 'bg-black/35 opacity-90 group-hover:bg-black/55 group-hover:opacity-100'
                      }`}
                    >
                      {isPlaying ? (
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                          <Pause className="w-3.5 h-3.5 text-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-black/40 border border-white/20 flex items-center justify-center shadow-md">
                          <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                        </div>
                      )}
                    </div>
                  </button>

                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Toggle play audio immediately so user hears the music
                      togglePlay(song.url);
                      handleQuickSelect(song);
                    }}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <p
                        className={`text-xs font-bold leading-snug truncate ${
                          isSelected ? 'text-rose-300' : 'text-white'
                        }`}
                      >
                        {song.title}
                      </p>
                      {song.isFullTrack && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-md font-semibold shrink-0">
                          Full Track
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenTrimmer(song);
                    }}
                    title="Customize clip / Select part"
                    className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-rose-300 border border-white/[0.06] transition-all cursor-pointer"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleQuickSelect(song);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                        : 'bg-white/[0.06] hover:bg-gradient-to-r hover:from-rose-500 hover:to-indigo-600 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </>
                    ) : (
                      <span>Select</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Footer: Custom Audio Upload */}
      <div className="p-3 border-t border-white/[0.08] bg-white/[0.02]">
        {!showCustomInput ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Have your own custom MP3?</span>
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="text-rose-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload custom audio</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-1 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Add Custom Audio</span>
              <button
                type="button"
                onClick={() => setShowCustomInput(false)}
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Song title..."
                className="bg-white/[0.04] border border-white/[0.08] text-xs px-3 py-1.5 rounded-xl outline-none focus:border-rose-500 text-white"
              />
              <input
                type="text"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                placeholder="Artist name..."
                className="bg-white/[0.04] border border-white/[0.08] text-xs px-3 py-1.5 rounded-xl outline-none focus:border-rose-500 text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="url"
                value={customAudioUrl}
                onChange={(e) => setCustomAudioUrl(e.target.value)}
                placeholder="Or paste audio URL (MP3/M4A link)..."
                className="flex-1 bg-white/[0.04] border border-white/[0.08] text-xs px-3 py-1.5 rounded-xl outline-none focus:border-rose-500 text-white"
              />
              {customAudioUrl.trim() && (
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
                >
                  Load &amp; Trim
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileUploadRef.current?.click()}
              disabled={isUploadingCustomAudio}
              className="w-full py-1.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              {isUploadingCustomAudio ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose MP3 File from Device</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
