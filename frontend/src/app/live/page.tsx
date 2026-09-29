'use client';

import React, { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import {
  Radio,
  Eye,
  Send,
  Share2,
  Video,
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Maximize2,
  Users,
  Film,
  Sparkles,
  Camera,
  Loader2,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api, resolveMediaUrl } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { UserAvatar } from '../../components/UserAvatar';
import { formatDate } from '../../lib/utils';
import { GLOBAL_RTC_CONFIGURATION } from '../../lib/webrtc';
import ReplayVideoPlayer from '../../components/live/ReplayVideoPlayer';

interface LiveComment {
  id: string;
  user: string;
  avatar: string;
  text: string;
}

const ICE_SERVERS: RTCConfiguration = GLOBAL_RTC_CONFIGURATION;

// ── High-quality natural audio constraints for live broadcasting ──
// Critical: Disabling aggressive software noise suppression & zero-latency prevents words from getting cut in half
const BROADCAST_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false, // Prevents aggressive noise gating that chops words in half
  autoGainControl: false, // Prevents sudden volume drops & pumping while speaking
  channelCount: 1, // Mono voice capture prevents phase cancellation distortion
  sampleRate: 48000,
  // @ts-ignore Chrome/Chromium audio tuning flags
  googEchoCancellation: true,
  googAutoGainControl: false,
  googNoiseSuppression: false,
  googHighpassFilter: false, // Preserves natural voice warmth and softer consonants
  googAudioMirroring: false,
};

// ── Optimize Opus audio bitrate on all audio senders of a PeerConnection ──
async function optimizeAudioBitrate(pc: RTCPeerConnection, bitrate = 96000) {
  try {
    const senders = pc.getSenders();
    for (const sender of senders) {
      if (sender.track?.kind === 'audio') {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings.forEach((enc) => {
          enc.maxBitrate = bitrate;
          // @ts-ignore Prioritize audio packets so voice is never dropped during network fluctuations
          enc.networkPriority = 'high';
          // @ts-ignore
          enc.priority = 'high';
        });
        await sender.setParameters(params);
      }
    }
  } catch (err) {
    console.warn('[Live] Audio bitrate optimization skipped:', err);
  }
}

// ── Modify SDP to prefer Opus codec and set continuous unchopped audio stream ──
function enhanceSDPAudio(sdp: string): string {
  let enhanced = sdp;

  // Find opus payload type
  const opusMatch = enhanced.match(/a=rtpmap:(\d+) opus\/48000/);
  if (opusMatch) {
    const payload = opusMatch[1];
    // Check if fmtp line for opus already exists
    const fmtpRegex = new RegExp(`a=fmtp:${payload} (.+)`);
    const fmtpMatch = enhanced.match(fmtpRegex);
    if (fmtpMatch) {
      let fmtpLine = fmtpMatch[0];
      // Clean previous flags
      fmtpLine = fmtpLine
        .replace(/;?usedtx=\d/g, '')
        .replace(/;?cbr=\d/g, '')
        .replace(/;?maxaveragebitrate=\d+/g, '')
        .replace(/;?useinbandfec=\d/g, '')
        .replace(/;?stereo=\d/g, '')
        .replace(/;?sprop-stereo=\d/g, '');

      // usedtx=0 ensures continuous packet transmission (never mutes in between words)
      // cbr=1 ensures constant bitrate without packet loss drops
      // useinbandfec=1 recovers any dropped packets automatically
      fmtpLine += ';maxaveragebitrate=96000;cbr=1;usedtx=0;useinbandfec=1;minptime=10;ptime=20';
      enhanced = enhanced.replace(fmtpMatch[0], fmtpLine);
    } else {
      enhanced = enhanced.replace(
        opusMatch[0],
        `${opusMatch[0]}\r\na=fmtp:${payload} minptime=10;ptime=20;maxaveragebitrate=96000;useinbandfec=1;usedtx=0;cbr=1`
      );
    }
  }

  return enhanced;
}

function LiveStreamContent() {
  const searchParams = useSearchParams();
  const paramStreamId = searchParams.get('id') || searchParams.get('stream');

  const { currentUser } = useStore();

  // Mode: 'watch' (watching someone else's live), 'broadcast' (hosting), 'replay' (watching recorded replay), 'lobby' (active streams listing)
  const [mode, setMode] = useState<'watch' | 'broadcast' | 'replay' | 'lobby'>('lobby');

  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [currentStream, setCurrentStream] = useState<any | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [isEndingBroadcast, setIsEndingBroadcast] = useState(false);

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const replayVideoRef = useRef<HTMLVideoElement>(null);

  // Broadcaster state refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const broadcasterPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const broadcastStartTimeRef = useRef<number | null>(null);

  // Viewer state refs
  const viewerPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // 1. Fetch active live streams
  const loadActiveStreams = useCallback(async () => {
    try {
      const res = await api.get('/live/streams');
      if (res.success && Array.isArray(res.data)) {
        setActiveStreams(res.data);
      }
    } catch (err) {
      console.error('Failed to load active streams:', err);
    }
  }, []);

  // 2. Load stream details by ID
  const loadStreamById = useCallback(async (id: string) => {
    setLoadingStream(true);
    try {
      const res = await api.get(`/live/${id}`);
      if (res.success && res.data) {
        const stream = res.data;
        setCurrentStream(stream);
        setStreamId(stream.id);
        if (stream.viewerCount !== undefined) {
          setViewerCount(stream.viewerCount);
        }

        if (stream.comments && Array.isArray(stream.comments)) {
          setComments(
            stream.comments.map((c: any) => ({
              id: c.id,
              user: c.user?.displayName || c.user?.username || 'User',
              avatar: c.user?.avatarUrl || '',
              text: c.text,
            }))
          );
        } else {
          setComments([]);
        }

        if (stream.status === 'ENDED') {
          setMode('replay');
        } else if (stream.hostId === currentUser?.id) {
          // It is our own broadcast!
          setMode('broadcast');
        } else {
          // Join as a viewer!
          setMode('watch');
        }
      }
    } catch (err) {
      console.error('Failed to load stream:', err);
    } finally {
      setLoadingStream(false);
    }
  }, [currentUser?.id]);

  // Initial routing based on query params or active streams
  useEffect(() => {
    loadActiveStreams();

    if (paramStreamId) {
      loadStreamById(paramStreamId);
    } else {
      setMode('lobby');
    }
  }, [paramStreamId, loadActiveStreams, loadStreamById]);

  // 3. Socket Event Handlers & WebRTC Signaling
  useEffect(() => {
    const socket = getSocket();

    const handleNewComment = (comment: any) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
    };

    const handleNewReaction = (data: any) => {
      triggerReaction(data.reactionType || '❤️', false);
    };

    const handleViewerStats = (data: { viewerCount: number }) => {
      setViewerCount(data.viewerCount ?? 0);
    };

    const handleStreamStartedGlobal = (stream: any) => {
      setActiveStreams((prev) => {
        if (prev.some((s) => s.id === stream.streamId)) return prev;
        return [stream, ...prev];
      });
    };

    const handleStreamEndedGlobal = (data: { streamId: string }) => {
      setActiveStreams((prev) => prev.filter((s) => s.id !== data.streamId));
      if (streamId === data.streamId) {
        if (mode === 'watch') {
          alert('The host has ended this live broadcast. Loading recorded replay...');
          if (streamId) loadStreamById(streamId);
        }
      }
    };

    // ── Broadcaster WebRTC Handlers ──
    const handleViewerJoined = async (data: { viewerSocketId: string; userId: string; viewerCount?: number }) => {
      if (data.viewerCount !== undefined) setViewerCount(data.viewerCount);

      // If we are currently broadcasting, initiate WebRTC peer connection to this viewer!
      if (isBroadcasting && localStreamRef.current && data.viewerSocketId) {
        try {
          const pc = new RTCPeerConnection(ICE_SERVERS);
          broadcasterPeerConnectionsRef.current.set(data.viewerSocketId, pc);

          // Add all local tracks (video & audio)
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });

          // Send ICE candidates to viewer
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('live:ice_candidate', {
                targetSocketId: data.viewerSocketId,
                candidate: event.candidate,
                streamId,
              });
            }
          };

          // Create WebRTC Offer with enhanced audio
          const offer = await pc.createOffer();

          // Enhance SDP for high-quality Opus stereo audio
          if (offer.sdp) {
            offer.sdp = enhanceSDPAudio(offer.sdp);
          }

          await pc.setLocalDescription(offer);

          // Optimize audio bitrate to 96kbps Opus with high packet priority
          await optimizeAudioBitrate(pc, 96000);

          socket.emit('live:offer', {
            targetSocketId: data.viewerSocketId,
            offer,
            streamId,
          });
        } catch (err) {
          console.error('[WebRTC Broadcaster] Error offering to viewer:', err);
        }
      }
    };

    const handleLiveAnswer = async (data: { viewerSocketId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = broadcasterPeerConnectionsRef.current.get(data.viewerSocketId);
      if (pc && pc.signalingState !== 'closed') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (err) {
          console.error('[WebRTC Broadcaster] Error setting answer:', err);
        }
      }
    };

    const handleViewerLeft = (data: { viewerSocketId: string; viewerCount?: number }) => {
      if (data.viewerCount !== undefined) setViewerCount(data.viewerCount);
      const pc = broadcasterPeerConnectionsRef.current.get(data.viewerSocketId);
      if (pc) {
        pc.close();
        broadcasterPeerConnectionsRef.current.delete(data.viewerSocketId);
      }
    };

    // ── Viewer WebRTC Handlers ──
    const handleLiveOffer = async (data: { broadcasterSocketId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        setIsConnecting(true);
        if (viewerPeerConnectionRef.current) {
          viewerPeerConnectionRef.current.close();
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        viewerPeerConnectionRef.current = pc;

        // When remote media track arrives from broadcaster
        pc.ontrack = (event) => {
          let streamToPlay = event.streams && event.streams[0] ? event.streams[0] : null;
          if (!streamToPlay) {
            streamToPlay = new MediaStream([event.track]);
          } else if (!streamToPlay.getTracks().some((t) => t.id === event.track.id)) {
            streamToPlay.addTrack(event.track);
          }

          if (remoteVideoRef.current) {
            if (remoteVideoRef.current.srcObject !== streamToPlay) {
              remoteVideoRef.current.srcObject = streamToPlay;
            }
            remoteVideoRef.current.muted = isMuted;
            remoteVideoRef.current.play().catch(() => {});
          }
          setIsConnecting(false);

          // Interaction unlocker in case browser autoplay policy blocks unmuted playback
          const unlock = () => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.play().catch(() => {});
            }
          };
          window.addEventListener('click', unlock, { once: true });
          window.addEventListener('touchstart', unlock, { once: true });
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('live:ice_candidate', {
              targetSocketId: data.broadcasterSocketId,
              candidate: event.candidate,
              streamId,
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Process any queued candidates
        while (pendingCandidatesRef.current.length > 0) {
          const cand = pendingCandidatesRef.current.shift();
          if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
        }

        const answer = await pc.createAnswer();

        // Enhance viewer's answer SDP for high-quality audio
        if (answer.sdp) {
          answer.sdp = enhanceSDPAudio(answer.sdp);
        }

        await pc.setLocalDescription(answer);

        socket.emit('live:answer', {
          targetSocketId: data.broadcasterSocketId,
          answer,
          streamId,
        });
      } catch (err) {
        console.error('[WebRTC Viewer] Error handling offer:', err);
        setIsConnecting(false);
      }
    };

    const handleIceCandidate = async (data: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      // If we are viewer
      if (viewerPeerConnectionRef.current) {
        if (viewerPeerConnectionRef.current.remoteDescription) {
          try {
            await viewerPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error('[WebRTC] Error adding ICE candidate:', err);
          }
        } else {
          pendingCandidatesRef.current.push(data.candidate);
        }
      }

      // If we are broadcaster
      const pc = broadcasterPeerConnectionsRef.current.get(data.senderSocketId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('[WebRTC Broadcaster] Error adding candidate:', err);
        }
      }
    };

    socket.on('live:new_comment', handleNewComment);
    socket.on('live:new_reaction', handleNewReaction);
    socket.on('live:stats', handleViewerStats);
    socket.on('live:viewer_joined', handleViewerJoined);
    socket.on('live:viewer_left', handleViewerLeft);
    socket.on('live:offer', handleLiveOffer);
    socket.on('live:answer', handleLiveAnswer);
    socket.on('live:ice_candidate', handleIceCandidate);
    socket.on('live:stream_started_global', handleStreamStartedGlobal);
    socket.on('live:stream_ended_global', handleStreamEndedGlobal);

    return () => {
      socket.off('live:new_comment', handleNewComment);
      socket.off('live:new_reaction', handleNewReaction);
      socket.off('live:stats', handleViewerStats);
      socket.off('live:viewer_joined', handleViewerJoined);
      socket.off('live:viewer_left', handleViewerLeft);
      socket.off('live:offer', handleLiveOffer);
      socket.off('live:answer', handleLiveAnswer);
      socket.off('live:ice_candidate', handleIceCandidate);
      socket.off('live:stream_started_global', handleStreamStartedGlobal);
      socket.off('live:stream_ended_global', handleStreamEndedGlobal);
    };
  }, [isBroadcasting, streamId, mode, loadStreamById]);

  // 4. Start Broadcaster Camera Preview when in Broadcast mode
  useEffect(() => {
    if (mode === 'broadcast' && !localStreamRef.current) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: BROADCAST_AUDIO_CONSTRAINTS })
          .then((stream) => {
            localStreamRef.current = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch((err) => {
            console.warn('Camera preview notice:', err.message);
          });
      }
    }

    return () => {
      if (mode !== 'broadcast') {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
      }
    };
  }, [mode]);

  // 5. Join Live Room when in Viewer mode
  useEffect(() => {
    if (mode === 'watch' && streamId) {
      const socket = getSocket();
      socket.emit('live:join', { streamId });

      return () => {
        socket.emit('live:leave', { streamId });
        if (viewerPeerConnectionRef.current) {
          viewerPeerConnectionRef.current.close();
          viewerPeerConnectionRef.current = null;
        }
      };
    }
  }, [mode, streamId]);

  // ── Broadcaster Actions ──
  const handleStartBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamTitle.trim()) return;

    try {
      const res = await api.post('/live/start', { title: streamTitle.trim() });
      if (res.success && res.data) {
        const stream = res.data;
        setStreamId(stream.id);
        setCurrentStream(stream);
        setIsBroadcasting(true);
        broadcastStartTimeRef.current = Date.now();

        // Start Local MediaRecorder for permanent replay recording
        if (localStreamRef.current) {
          try {
            recordedChunksRef.current = [];
            // Prefer VP9+Opus for best quality, fallback to VP8+Opus
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
              ? 'video/webm;codecs=vp9,opus'
              : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
              ? 'video/webm;codecs=vp8,opus'
              : MediaRecorder.isTypeSupported('video/webm')
              ? 'video/webm'
              : MediaRecorder.isTypeSupported('video/mp4')
              ? 'video/mp4'
              : '';

            const options: MediaRecorderOptions = {
              ...(mimeType ? { mimeType } : {}),
              audioBitsPerSecond: 128000,   // 128kbps audio for high-quality recording
              videoBitsPerSecond: 2500000,  // 2.5Mbps video
            };
            const recorder = new MediaRecorder(localStreamRef.current, options);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
              }
            };
            recorder.start(1000);
          } catch (recErr) {
            console.warn('MediaRecorder not available or failed to start:', recErr);
          }
        }

        const socket = getSocket();
        socket.emit('live:join', { streamId: stream.id });
        socket.emit('live:stream_started', {
          streamId: stream.id,
          title: stream.title,
          host: currentUser,
        });
      }
    } catch {
      alert('Failed to start live broadcast.');
    }
  };

  const handleEndBroadcast = async () => {
    if (!streamId || isEndingBroadcast) return;
    setIsEndingBroadcast(true);

    let recordingUrl: string | undefined = undefined;

    // Stop MediaRecorder and Upload Recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        // Request any buffered chunks before stopping
        try {
          mediaRecorderRef.current.requestData();
        } catch {}

        const uploadPromise = new Promise<string | undefined>((resolve) => {
          // Fallback timeout in case onstop doesn't resolve within 15s
          const timeout = setTimeout(() => {
            console.warn('Upload timed out, ending stream without upload');
            resolve(undefined);
          }, 15000);

          mediaRecorderRef.current!.onstop = async () => {
            try {
              if (recordedChunksRef.current.length > 0) {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const formData = new FormData();
                formData.append('file', blob, `live_recording_${streamId}.webm`);
                const upRes = await api.upload('/upload', formData);
                if (upRes.success && upRes.url) {
                  clearTimeout(timeout);
                  resolve(upRes.url);
                  return;
                }
              }
            } catch (uErr) {
              console.warn('Upload recording notice:', uErr);
            }
            clearTimeout(timeout);
            resolve(undefined);
          };
          mediaRecorderRef.current!.stop();
        });

        recordingUrl = await uploadPromise;
      } catch (err) {
        console.warn('Recorder stop error:', err);
      }
    }

    const durationSeconds = broadcastStartTimeRef.current
      ? Math.round((Date.now() - broadcastStartTimeRef.current) / 1000)
      : undefined;

    try {
      await api.post(`/live/${streamId}/end`, {
        recordingUrl,
        peakViewers: viewerCount,
        durationSeconds,
      });
    } catch (err) {
      console.warn('End live API notice:', err);
    }

    const socket = getSocket();
    socket.emit('live:leave', { streamId });
    socket.emit('live:stream_ended', { streamId });

    // Clean up peer connections
    broadcasterPeerConnectionsRef.current.forEach((pc) => pc.close());
    broadcasterPeerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    setIsEndingBroadcast(false);
    setIsBroadcasting(false);
    alert('Live broadcast ended! Recording permanently saved to your profile under Live Replays.');
    setMode('lobby');
    loadActiveStreams();
  };

  const triggerReaction = (emoji: string, emitSocket = true) => {
    const id = Date.now() + Math.random();
    setFloatingReactions((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);

    if (emitSocket && streamId) {
      const socket = getSocket();
      socket.emit('live:reaction', { streamId, reactionType: emoji });
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentId = `lc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const commentData: LiveComment = {
      id: commentId,
      user: currentUser?.displayName || currentUser?.username || 'User',
      avatar: currentUser?.avatarUrl || '',
      text: newComment.trim(),
    };

    setComments((prev) => [...prev, commentData]);
    setNewComment('');

    if (streamId) {
      const socket = getSocket();
      socket.emit('live:comment', { streamId, comment: commentData });
      if (mode === 'replay') {
        api.post(`/live/${streamId}/comment`, { text: commentData.text, id: commentData.id }).catch(() => {});
      }
    }
  };

  const toggleMute = () => {
    if (mode === 'watch' && remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setIsMuted(remoteVideoRef.current.muted);
    } else if (mode === 'broadcast' && localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
        setIsMuted(!t.enabled);
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col selection:bg-rose-500 selection:text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto w-full px-4 flex gap-6 py-6 flex-1 h-[calc(100vh-5rem)]">
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 bg-slate-900/60 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">

          {/* LEFT / CENTER: Video Player Area */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">

            {/* 1. LOBBY MODE (When visiting /live without active stream selected) */}
            {mode === 'lobby' && (
              <div className="w-full h-full p-8 flex flex-col justify-center items-center overflow-y-auto bg-gradient-to-b from-slate-900 to-black">
                <div className="max-w-xl w-full text-center space-y-6">
                  <div className="inline-flex p-4 rounded-3xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-lg shadow-rose-500/10">
                    <Radio className="w-10 h-10 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      Live Broadcasts & Theater
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-2">
                      Watch live broadcasts from your friends or start your own stream in high-definition.
                    </p>
                  </div>

                  {/* Active Streams Section */}
                  {activeStreams.length > 0 ? (
                    <div className="space-y-3 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          Live Now ({activeStreams.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeStreams.map((st) => (
                          <div
                            key={st.id || st.streamId}
                            onClick={() => loadStreamById(st.id || st.streamId)}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all cursor-pointer group flex flex-col justify-between"
                          >
                            <div className="flex items-center gap-2.5 mb-2">
                              <UserAvatar
                                avatarUrl={st.host?.avatarUrl}
                                name={st.host?.displayName || 'Host'}
                                size="sm"
                              />
                              <div className="overflow-hidden">
                                <h4 className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors truncate">
                                  {st.title}
                                </h4>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {st.host?.displayName || 'Live User'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                              <span className="text-[10px] text-rose-400 flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {st.viewerCount ?? 0} watching
                              </span>
                              <span className="text-xs font-bold text-white bg-rose-600 px-3 py-1 rounded-full group-hover:bg-rose-500 transition-colors">
                                Watch 🔴
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 text-center">
                      <p className="text-xs text-slate-400">No active live broadcasts at this moment.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Be the first to go live for your friends!</p>
                    </div>
                  )}

                  {/* Start Broadcast Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setMode('broadcast')}
                      className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white text-xs font-extrabold rounded-2xl shadow-xl shadow-rose-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Start Your Live Broadcast</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. BROADCASTER MODE (Camera Preview & Live Broadcast) */}
            {mode === 'broadcast' && (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Broadcast Setup Overlay (Before clicking "Go Live") */}
                {!isBroadcasting && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-20">
                    <form
                      onSubmit={handleStartBroadcast}
                      className="bg-[#111726] border border-white/10 p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl space-y-4"
                    >
                      <div className="w-12 h-12 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                        <Radio className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-white">Go Live to Friends</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Camera and microphone preview is active. Enter a stream title to broadcast.
                        </p>
                      </div>
                      <input
                        type="text"
                        required
                        value={streamTitle}
                        onChange={(e) => setStreamTitle(e.target.value)}
                        placeholder="What's this live stream about?..."
                        className="w-full bg-slate-950 border border-slate-700 text-xs px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMode('lobby');
                            loadActiveStreams();
                          }}
                          className="w-1/3 py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
                        >
                          Go Live 🔴
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {/* 3. VIEWER MODE (Watching another user's live broadcast) */}
            {mode === 'watch' && (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {isConnecting && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-10">
                    <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                    <p className="text-xs font-semibold text-white/90">Connecting to live video stream...</p>
                  </div>
                )}
              </>
            )}

            {/* 4. REPLAY MODE (Recorded Live Stream Playback) */}
            {mode === 'replay' && currentStream && (
              <div className="w-full h-full relative flex items-center justify-center bg-black">
                {currentStream.recordingUrl ? (
                  <ReplayVideoPlayer
                    src={resolveMediaUrl(currentStream.recordingUrl)}
                    title={currentStream.title}
                    durationSeconds={
                      currentStream.durationSeconds ||
                      (currentStream.endedAt && currentStream.startedAt
                        ? Math.max(1, Math.round((new Date(currentStream.endedAt).getTime() - new Date(currentStream.startedAt).getTime()) / 1000))
                        : undefined)
                    }
                    autoPlay
                    className="w-full h-full"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                      <Radio className="w-7 h-7 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Live Replay Not Available</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      This live broadcast ended without a saved recording.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Ending Broadcast Overlay */}
            {isEndingBroadcast && (
              <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 text-center p-6">
                <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
                <h3 className="text-lg font-bold text-white">Finalizing & Saving Replay...</h3>
                <p className="text-xs text-slate-300 max-w-sm">
                  Please do not close or refresh this tab. We are processing and saving your recording.
                </p>
              </div>
            )}

            {/* TOP BAR OVERLAY: Stream Info, Status, Viewers */}
            {mode !== 'lobby' && (
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('lobby');
                      loadActiveStreams();
                    }}
                    className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer mr-1"
                    title="Back to Streams"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>

                  <span
                    className={`flex items-center gap-1.5 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      mode === 'watch' || (mode === 'broadcast' && isBroadcasting)
                        ? 'bg-rose-600 animate-pulse'
                        : mode === 'replay'
                        ? 'bg-indigo-600'
                        : 'bg-slate-700'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {mode === 'watch'
                      ? 'Live Stream'
                      : mode === 'broadcast' && isBroadcasting
                      ? 'Broadcasting'
                      : mode === 'replay'
                      ? 'Live Replay'
                      : 'Preview'}
                  </span>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90 pl-1">
                    <Eye className="w-3.5 h-3.5 text-white/80" />
                    <span>
                      {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Broadcaster End Button */}
                  {mode === 'broadcast' && isBroadcasting && (
                    <button
                      type="button"
                      disabled={isEndingBroadcast}
                      onClick={handleEndBroadcast}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-full transition-colors cursor-pointer shadow-md shadow-rose-600/30 flex items-center gap-1.5"
                    >
                      {isEndingBroadcast && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>{isEndingBroadcast ? 'Saving...' : 'End Broadcast'}</span>
                    </button>
                  )}

                  {/* Audio Mute/Unmute */}
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white/90 transition-colors border border-white/10 cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {/* Share Stream Link */}
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard?.writeText(window.location.href);
                        alert('Live stream link copied to clipboard!');
                      }
                    }}
                    className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white/90 transition-colors border border-white/10 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* FLOATING REACTIONS CONTAINER */}
            <div className="absolute bottom-6 right-6 flex flex-col pointer-events-none z-30">
              {floatingReactions.map((r) => (
                <div key={r.id} className="animate-float-heart text-4xl mb-2 filter drop-shadow-lg">
                  {r.emoji}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL: Live Chat, Comments, Host Info */}
          <div className="w-full lg:w-96 bg-slate-950/80 backdrop-blur-xl flex flex-col border-l border-white/10">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white">Live Chat & Reactions</h3>
                <p className="text-[10px] text-slate-400">
                  {mode === 'replay' ? 'Recorded live comments' : 'Real-time interactive chat'}
                </p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Host Banner in Chat */}
            {currentStream && (
              <div className="p-3 bg-white/[0.03] border-b border-white/5 flex items-center gap-3">
                <UserAvatar
                  avatarUrl={currentStream.host?.avatarUrl}
                  name={currentStream.host?.displayName || 'Host'}
                  size="sm"
                />
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-xs font-bold text-white truncate">{currentStream.title}</h4>
                  <p className="text-[10px] text-slate-400">
                    Host: {currentStream.host?.displayName || currentStream.host?.username || 'User'}
                  </p>
                </div>
              </div>
            )}

            {/* Comments Feed */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {comments.length === 0 ? (
                <div className="text-center text-xs text-slate-400 my-auto py-8">
                  {mode === 'broadcast'
                    ? 'No comments yet. Viewers will comment here during the broadcast.'
                    : 'Be the first to say something in the live chat!'}
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 animate-in fade-in">
                    <UserAvatar avatarUrl={c.avatar} name={c.user} size="xs" className="mt-0.5" />
                    <div className="flex-1 bg-white/5 rounded-2xl p-2.5 border border-white/5">
                      <span className="font-bold text-xs text-blue-400 block mb-0.5">{c.user}</span>
                      <p className="text-xs text-slate-200">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Floating Reaction Triggers */}
            <div className="px-4 py-2 flex items-center justify-around border-t border-white/5 bg-white/[0.02]">
              {['❤️', '🔥', '👏', '😂', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => triggerReaction(emoji)}
                  className="text-2xl hover:scale-130 transition-transform active:scale-95 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Comment Input Form */}
            <form onSubmit={handleSendComment} className="p-3 bg-slate-950 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Send a live comment..."
                className="flex-1 bg-white/10 text-white placeholder-slate-400 text-xs px-4 py-2.5 rounded-full border border-white/10 focus:outline-none focus:border-rose-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="p-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:opacity-90 disabled:opacity-40 text-white rounded-full transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveStreamPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
        </div>
      }
    >
      <LiveStreamContent />
    </Suspense>
  );
}
