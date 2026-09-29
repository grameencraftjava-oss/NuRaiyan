'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Clock,
} from 'lucide-react';

interface ReplayVideoPlayerProps {
  src: string;
  title?: string;
  durationSeconds?: number;
  autoPlay?: boolean;
  className?: string;
  onEnded?: () => void;
}

export default function ReplayVideoPlayer({
  src,
  title,
  durationSeconds,
  autoPlay = false,
  className = '',
  onEnded,
}: ReplayVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(durationSeconds || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format seconds to mm:ss (or hh:mm:ss if > 1h)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fix Chrome/WebM Infinity duration issue
  const handleLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid) return;

    if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
      setDuration(vid.duration);
    } else {
      // Chrome MediaRecorder WebM trick to retrieve actual duration
      vid.currentTime = 1e101;
      vid.ontimeupdate = () => {
        if (!vid) return;
        vid.ontimeupdate = null;
        if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
          setDuration(vid.duration);
        } else if (durationSeconds && durationSeconds > 0) {
          setDuration(durationSeconds);
        }
        vid.currentTime = 0;
      };
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setCurrentTime(vid.currentTime);
    if ((!duration || !isFinite(duration)) && vid.duration && isFinite(vid.duration) && vid.duration > 0) {
      setDuration(vid.duration);
    }
  };

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }, []);

  const seekRelative = (deltaSeconds: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    const target = Math.max(0, Math.min(effectiveDuration, vid.currentTime + deltaSeconds));
    vid.currentTime = target;
    setCurrentTime(target);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const vid = videoRef.current;
    if (!bar || !vid || effectiveDuration <= 0) return;

    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = fraction * effectiveDuration;

    vid.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || effectiveDuration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const hoverX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const fraction = hoverX / rect.width;
    setHoverTime(fraction * effectiveDuration);
    setHoverPosition(hoverX);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverTime(null);
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = val;
    setVolume(val);
    vid.muted = val === 0;
    setIsMuted(val === 0);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      try {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Fullscreen request error:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Exit fullscreen error:', err);
      }
    }
  };

  const changeSpeed = (speed: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const effectiveDuration = (duration > 0 && isFinite(duration)) ? duration : (durationSeconds || 0);
  const remainingSeconds = Math.max(0, effectiveDuration - currentTime);
  const progressPercent = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`relative group bg-black overflow-hidden select-none flex items-center justify-center ${className}`}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Big Center Play/Pause Indicator (shows on pause or initial load) */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl backdrop-blur-md hover:scale-110 transition-all z-10 cursor-pointer"
          title="Play video"
        >
          <Play className="w-8 h-8 fill-white ml-1" />
        </button>
      )}

      {/* Top Overlay Header */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h4 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-md">
            {title || 'Recorded Live Stream Replay'}
          </h4>
        </div>
        <a
          href={src}
          download={`live_replay_${Date.now()}.webm`}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Download Recording"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download</span>
        </a>
      </div>

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-8 pb-3 px-4 transition-opacity duration-300 z-20 flex flex-col gap-2 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleProgressBarClick}
          onMouseMove={handleProgressBarMouseMove}
          onMouseLeave={handleProgressBarMouseLeave}
          className="relative h-2 hover:h-3 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-all flex items-center"
        >
          {/* Progress fill */}
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-indigo-500 rounded-full relative"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          >
            {/* Scrubber Knob */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
          </div>

          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 px-2 py-0.5 bg-black/90 text-[10px] font-bold text-white rounded border border-white/20 pointer-events-none -translate-x-1/2 shadow-lg"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Buttons and Detailed Counters */}
        <div className="flex items-center justify-between text-white text-xs gap-2 pt-1">
          {/* Left Controls: Play, Rewind 10s, Forward 10s, Volume, Elapsed / Total Duration */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            <button
              type="button"
              onClick={() => seekRelative(-10)}
              className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer relative"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[8px] font-extrabold absolute top-2 left-1.5">10</span>
            </button>

            <button
              type="button"
              onClick={() => seekRelative(10)}
              className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer relative"
              title="Forward 10s"
            >
              <RotateCw className="w-4 h-4" />
              <span className="text-[8px] font-extrabold absolute top-2 left-1.5">10</span>
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-18 h-1 accent-rose-500 bg-white/20 rounded-full cursor-pointer opacity-70 group-hover/volume:opacity-100 transition-opacity"
              />
            </div>

            {/* Total Duration & Elapsed Time Display */}
            <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-slate-300 ml-1">
              <span className="text-white font-bold">{formatTime(currentTime)}</span>
              <span>/</span>
              <span className="font-semibold text-slate-200">
                {effectiveDuration > 0 ? formatTime(effectiveDuration) : '--:--'}
              </span>

              {/* Remaining Seconds Badge (Clearly states how many seconds are left) */}
              {effectiveDuration > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                  <Clock className="w-2.5 h-2.5" />
                  -{formatTime(remainingSeconds)} left
                </span>
              )}
            </div>
          </div>

          {/* Right Controls: Playback Speed, Fullscreen */}
          <div className="flex items-center gap-2 relative">
            {/* Speed Selector */}
            <button
              type="button"
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-200 cursor-pointer"
              title="Playback Speed"
            >
              {playbackSpeed}x
            </button>

            {showSpeedMenu && (
              <div className="absolute right-8 bottom-8 bg-slate-900 border border-white/10 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 z-30 min-w-[70px]">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => changeSpeed(spd)}
                    className={`px-2 py-1 text-[10px] rounded text-left transition-colors cursor-pointer ${
                      playbackSpeed === spd ? 'bg-rose-600 text-white font-bold' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
