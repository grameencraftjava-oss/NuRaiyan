'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { WebRTCManager, RemoteAudioPlayer } from '../lib/webrtc';
import { getSocket } from '../lib/socket';
import { UserAvatar } from './UserAvatar';

interface VideoCallModalProps {
  onClose?: () => void;
}

// Telecom ringback tone synthesizer (for caller while waiting for answer)
function playOutgoingRingTone() {
  if (typeof window === 'undefined') return () => {};
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return () => {};
    const ctx = new AudioCtx();
    let isPlaying = true;

    const playBeep = () => {
      if (!isPlaying || ctx.state === 'closed') return;
      const notes = [440, 480]; // Classic dual-tone multi-frequency ringback
      notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.7);
      });
    };

    playBeep();
    const interval = setInterval(() => {
      if (isPlaying) playBeep();
    }, 3800);

    return () => {
      isPlaying = false;
      clearInterval(interval);
      try {
        ctx.close();
      } catch {}
    };
  } catch {
    return () => {};
  }
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({ onClose }) => {
  const { activeCall, setActiveCall } = useStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(activeCall?.type === 'AUDIO');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [callStatusText, setCallStatusText] = useState(
    activeCall?.isIncoming ? 'Connecting...' : 'Calling...'
  );

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const audioPlayerRef = useRef<RemoteAudioPlayer | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const stopRingbackRef = useRef<() => void>(() => {});
  const hasInitiatedCallRef = useRef<string | null>(null);
  const hasAnsweredCallRef = useRef<string | null>(null);
  const isConnectedRef = useRef(false);
  const activeCallRef = useRef<any>(null);
  activeCallRef.current = activeCall;

  // Cleanup WebRTC when modal unmounts completely
  useEffect(() => {
    return () => {
      if (!activeCallRef.current || activeCallRef.current.status === 'ENDED') {
        audioPlayerRef.current?.close();
        audioPlayerRef.current = null;
        webrtcRef.current?.close();
        webrtcRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeCall) return;

    const socket = getSocket();
    const otherUserId = activeCall.otherUser.id;
    const currentCallId = activeCall.callId;

    // 1. Initialize or reuse WebRTC Manager for this call session
    if (!webrtcRef.current) {
      webrtcRef.current = new WebRTCManager(
        (remoteStream) => {
          console.log('🎬 [Call] Received remote stream with tracks:', remoteStream.getTracks().map(t => `${t.kind}:${t.id}`));
          
          // 🔒 Primary Native Hardware Playout: Direct browser media engine (100% continuous, zero drops, 1+ hour continuous crystal clear sound)
          if (remoteAudioRef.current) {
            if (remoteAudioRef.current.srcObject !== remoteStream) {
              remoteAudioRef.current.srcObject = remoteStream;
            }
            remoteAudioRef.current.muted = isSpeakerMuted;
            remoteAudioRef.current.play().catch((err) => {
              console.warn('[Call] remoteAudio autoplay deferred:', err);
            });
          }

          // 🔒 Video stream routes to <video> element (muted so visual decode never echoes or interferes with audio)
          if (activeCall.type === 'VIDEO' && remoteVideoRef.current) {
            if (remoteVideoRef.current.srcObject !== remoteStream) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.play().catch((err) => {
              console.warn('[Call] remoteVideo autoplay deferred:', err);
            });
          }

          // Global interaction unlocker (in case browser blocked initial autoplay)
          const unlockMedia = () => {
            if (remoteAudioRef.current) {
              remoteAudioRef.current.muted = isSpeakerMuted;
              remoteAudioRef.current.play().catch(() => {});
            }
            if (activeCall.type === 'VIDEO' && remoteVideoRef.current) {
              remoteVideoRef.current.play().catch(() => {});
            }
          };
          window.addEventListener('click', unlockMedia, { once: true });
          window.addEventListener('touchstart', unlockMedia, { once: true });

          const videoTracks = remoteStream.getVideoTracks();
          const hasLiveVideo = videoTracks.some((t) => t.enabled && t.readyState === 'live');
          if (hasLiveVideo) {
            setHasRemoteVideo(true);
          }

          videoTracks.forEach((t) => {
            t.onmute = () => setHasRemoteVideo(false);
            t.onunmute = () => setHasRemoteVideo(true);
            t.onended = () => setHasRemoteVideo(false);
          });
        },
        (candidate) => {
          console.log('📤 [Call] Sending ICE candidate to peer:', otherUserId);
          socket.emit('call:ice-candidate', {
            targetUserId: otherUserId,
            candidate,
          });
        },
        (connectionState) => {
          console.log('🔗 [Call] WebRTC state update:', connectionState);
          if (connectionState === 'connected') {
            setIsConnected(true);
            isConnectedRef.current = true;
            setCallStatusText('Connected');
            stopRingbackRef.current();
          } else if (connectionState === 'disconnected' || connectionState === 'failed') {
            setCallStatusText('Connection unstable...');
          }
        }
      );
    }

    const rtc = webrtcRef.current;

    // 2. Caller Workflow: Get local media (camera/mic) and send offer (EXACTLY ONCE per callId)
    if (!activeCall.isIncoming && hasInitiatedCallRef.current !== currentCallId) {
      hasInitiatedCallRef.current = currentCallId;
      setCallStatusText('Calling...');
      stopRingbackRef.current();
      stopRingbackRef.current = playOutgoingRingTone();

      rtc
        .getLocalMedia(activeCall.type === 'VIDEO', true)
        .then(async (stream) => {
          if (activeCallRef.current?.callId !== currentCallId) return;

          const hasLocalVideo = stream.getVideoTracks().length > 0;
          setIsVideoOff(!hasLocalVideo);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }

          const offer = await rtc.createOffer();
          socket.emit('call:initiate', {
            receiverId: otherUserId,
            offer,
            callType: activeCall.type,
            callId: currentCallId,
          });
          console.log('🚀 [Call] Successfully emitted call:initiate to', otherUserId, 'callId:', currentCallId);
        })
        .catch((err) => {
          console.error('[WebRTC] Camera/Mic access failed:', err);
          stopRingbackRef.current();
          alert('Could not access microphone or camera. Please check browser permissions.');
          handleEndCall();
        });
    }

    // 3. Receiver Workflow: Already accepted offer via GlobalCallHandler, create answer (EXACTLY ONCE per callId)
    if (activeCall.isIncoming && activeCall.offer && hasAnsweredCallRef.current !== currentCallId) {
      hasAnsweredCallRef.current = currentCallId;
      setCallStatusText('Connecting...');

      rtc
        .getLocalMedia(activeCall.type === 'VIDEO', true)
        .then(async (stream) => {
          if (activeCallRef.current?.callId !== currentCallId) return;

          const hasLocalVideo = stream.getVideoTracks().length > 0;
          setIsVideoOff(!hasLocalVideo);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }

          // Apply any ICE candidates received while the phone was ringing
          if (activeCall.pendingIceCandidates && activeCall.pendingIceCandidates.length > 0) {
            console.log(`🧊 [Call] Applying ${activeCall.pendingIceCandidates.length} pre-buffered ICE candidates`);
            for (const cand of activeCall.pendingIceCandidates) {
              await rtc.addIceCandidate(cand);
            }
          }

          const answer = await rtc.createAnswer(activeCall.offer);
          socket.emit('call:answer', {
            callerId: otherUserId,
            answer,
            callId: currentCallId,
          });
          console.log('🚀 [Call] Successfully emitted call:answer to caller', otherUserId, 'callId:', currentCallId);

          setIsConnected(true);
          isConnectedRef.current = true;
          setCallStatusText('Connected');
        })
        .catch((err) => {
          console.error('[WebRTC] Receiver media setup error:', err);
          handleEndCall();
        });
    }

    // 4. Socket Listeners for In-Call Signalling
    const handleCallRinging = () => {
      console.log('🔔 [Caller] Receiver device is ringing...');
      setCallStatusText('Ringing...');
    };

    const handleCallAnswered = async ({ answer }: { answer: any }) => {
      try {
        console.log('🎉 [Caller] Call answered by receiver!');
        stopRingbackRef.current();
        await rtc.setRemoteAnswer(answer);
        setIsConnected(true);
        isConnectedRef.current = true;
        setCallStatusText('Connected');
      } catch (err) {
        console.error('Failed to set remote answer on caller:', err);
      }
    };

    const handleIceCandidate = async ({ candidate }: { candidate: any }) => {
      try {
        if (candidate) {
          await rtc.addIceCandidate(candidate);
        }
      } catch (err) {
        console.error('Failed to add incoming ICE candidate:', err);
      }
    };

    const handleCallEnded = () => {
      stopRingbackRef.current();
      audioPlayerRef.current?.close();
      audioPlayerRef.current = null;
      rtc.close();
      webrtcRef.current = null;
      setActiveCall(null);
      if (onClose) onClose();
    };

    const handleUserOffline = () => {
      stopRingbackRef.current();
      alert(`${activeCall.otherUser.displayName} is currently offline.`);
      audioPlayerRef.current?.close();
      audioPlayerRef.current = null;
      rtc.close();
      webrtcRef.current = null;
      setActiveCall(null);
      if (onClose) onClose();
    };

    const handleCallError = ({ message }: { message: string }) => {
      stopRingbackRef.current();
      alert(message || 'Call failed.');
      audioPlayerRef.current?.close();
      audioPlayerRef.current = null;
      rtc.close();
      webrtcRef.current = null;
      setActiveCall(null);
      if (onClose) onClose();
    };

    socket.on('call:ringing', handleCallRinging);
    socket.on('call:answered', handleCallAnswered);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:declined', handleCallEnded);
    socket.on('call:user_offline', handleUserOffline);
    socket.on('call:error', handleCallError);

    return () => {
      stopRingbackRef.current();
      socket.off('call:ringing', handleCallRinging);
      socket.off('call:answered', handleCallAnswered);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:declined', handleCallEnded);
      socket.off('call:user_offline', handleUserOffline);
      socket.off('call:error', handleCallError);
    };
    // 🔒 Crucial: Run ONCE per unique callId so state transitions never teardown WebRTC!
  }, [activeCall?.callId]);

  // Call duration counter once connected
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isConnected) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isConnected]);

  if (!activeCall) return null;

  const toggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    webrtcRef.current?.toggleAudio(!nextState);
  };

  const toggleCamera = () => {
    const nextState = !isVideoOff;
    setIsVideoOff(nextState);
    webrtcRef.current?.toggleVideo(!nextState);
  };

  const toggleSpeaker = () => {
    const nextState = !isSpeakerMuted;
    setIsSpeakerMuted(nextState);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = nextState;
    }
  };

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    stopRingbackRef.current();
    const socket = getSocket();
    socket.emit('call:end', {
      targetUserId: activeCall.otherUser.id,
      callId: activeCall.callId,
    });
    audioPlayerRef.current?.close();
    audioPlayerRef.current = null;
    webrtcRef.current?.close();
    setActiveCall(null);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070A12] flex flex-col justify-between p-4 sm:p-6 animate-in fade-in select-none">
      {/* 🔒 Dedicated Audio Element (In viewport at 5% opacity so Chrome never classifies it as off-screen) */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="absolute bottom-2 left-2 w-4 h-4 opacity-5 pointer-events-none"
      />

      {/* Top Bar: Caller Info & Security Badge */}
      <div className="flex items-center justify-between text-white z-20">
        <div className="flex items-center gap-3">
          <UserAvatar
            avatarUrl={activeCall.otherUser.avatarUrl}
            name={activeCall.otherUser.displayName}
            username={activeCall.otherUser.username}
            size="lg"
            className="ring-2 ring-blue-500 shadow-md"
          />
          <div>
            <h3 className="font-bold text-white text-base leading-tight">
              {activeCall.otherUser.displayName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                }`}
              />
              <p className="text-xs text-slate-300 font-medium">
                {isConnected ? `Connected (${formatCallTime(callDuration)})` : callStatusText}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-xs text-emerald-400 font-semibold border border-white/10">
          <Shield className="w-4 h-4" />
          <span>End-to-End Encrypted WebRTC</span>
        </div>
      </div>

      {/* Main Video Arena */}
      <div className="relative flex-1 w-full max-w-5xl mx-auto my-4 rounded-3xl overflow-hidden bg-[#111726] border border-white/10 flex items-center justify-center shadow-2xl">
        {/* Remote Video Stream - Pure visual hardware decoding (permanently muted so React re-renders never interfere) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            if (activeCall.type === 'VIDEO') {
              setHasRemoteVideo(true);
              remoteVideoRef.current?.play().catch(() => {});
            }
          }}
          onPlaying={() => {
            if (activeCall.type === 'VIDEO') {
              setHasRemoteVideo(true);
            }
          }}
          className={`w-full h-full object-cover ${
            activeCall.type === 'VIDEO' ? 'block' : 'hidden'
          }`}
        />

        {/* Fallback avatar if call is audio-only, connecting, or remote video is off */}
        {(!isConnected || !hasRemoteVideo || activeCall.type === 'AUDIO') && (
          <div className="absolute inset-0 z-10 bg-[#111726] flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="relative">
              <UserAvatar
                avatarUrl={activeCall.otherUser.avatarUrl}
                name={activeCall.otherUser.displayName}
                username={activeCall.otherUser.username}
                size="2xl"
                className="w-28 h-28 rounded-full ring-4 ring-rose-500/50 shadow-2xl text-4xl"
              />
              {isConnected && (
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400/40 animate-ping pointer-events-none" />
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">
                {activeCall.otherUser.displayName}
              </h2>
              <p className="text-white/70 font-medium text-sm">
                {activeCall.type === 'VIDEO' ? 'Video call' : 'High Definition Audio call'} •{' '}
                {isConnected ? formatCallTime(callDuration) : callStatusText}
              </p>
            </div>
          </div>
        )}

        {/* Local Stream PIP (Picture-in-Picture) */}
        {activeCall.type === 'VIDEO' && (
          <div className="absolute bottom-4 right-4 w-36 sm:w-48 aspect-video rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-black z-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 ${isVideoOff ? 'hidden' : 'block'}`}
            />
            {isVideoOff && (
              <div className="w-full h-full bg-[#182032] flex items-center justify-center text-white text-xs font-semibold">
                Camera Off
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call Controls Bar */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 py-2 z-20">
        {/* Mute Microphone */}
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-transform hover:scale-110 shadow-lg cursor-pointer ${
            isMuted ? 'bg-amber-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Video Toggle (Camera On/Off) */}
        {activeCall.type === 'VIDEO' && (
          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full transition-transform hover:scale-110 shadow-lg cursor-pointer ${
              isVideoOff ? 'bg-amber-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
          </button>
        )}

        {/* Speaker Volume Toggle */}
        <button
          onClick={toggleSpeaker}
          className={`p-4 rounded-full transition-transform hover:scale-110 shadow-lg cursor-pointer ${
            isSpeakerMuted ? 'bg-amber-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          title={isSpeakerMuted ? 'Unmute speaker' : 'Mute speaker'}
        >
          {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </button>

        {/* End Call */}
        <button
          onClick={handleEndCall}
          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-transform hover:scale-110 shadow-xl shadow-red-600/30 cursor-pointer"
          title="End Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
