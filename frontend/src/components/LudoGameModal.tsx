'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Trophy,
  Sparkles,
  Flame,
  Star,
  Swords,
  Mic,
  MicOff,
  Phone,
  Radio,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Send,
  Timer,
  Clock,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getSocket } from '../lib/socket';
import { UserAvatar } from './UserAvatar';
import {
  GLOBAL_RTC_CONFIGURATION,
  HIGH_QUALITY_AUDIO_CONSTRAINTS,
  tuneOpusSDP,
  RemoteAudioPlayer,
} from '../lib/webrtc';

// ── Web Audio Synthesizer (Realistic Ludo FX) ─────────────────────
function playSynthesizedSound(type: 'dice' | 'move' | 'capture' | 'win') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'dice') {
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180 + Math.random() * 260, ctx.currentTime + i * 0.045);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.045 + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.045);
        osc.stop(ctx.currentTime + i * 0.045 + 0.06);
      }
    } else if (type === 'move') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'capture') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.28, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.36);
      });
    }
  } catch {}
}

// ── Standard 15x15 Ludo Track Mapping (52 Common Cells) ───────────
const MAIN_TRACK_COORDS: { r: number; c: number; safe?: boolean }[] = [
  // Red Track starts at (6, 1)
  { r: 6, c: 1, safe: true }, // 0 (Red Start)
  { r: 6, c: 2 },
  { r: 6, c: 3 },
  { r: 6, c: 4 },
  { r: 6, c: 5 },
  { r: 5, c: 6 },
  { r: 4, c: 6 },
  { r: 3, c: 6 },
  { r: 2, c: 6, safe: true }, // 8 (Safe Star)
  { r: 1, c: 6 },
  { r: 0, c: 6 },
  { r: 0, c: 7 },
  { r: 0, c: 8 },
  { r: 1, c: 8, safe: true }, // 13 (Yellow Start Star)
  { r: 2, c: 8 },
  { r: 3, c: 8 },
  { r: 4, c: 8 },
  { r: 5, c: 8 },
  { r: 6, c: 9 },
  { r: 6, c: 10 },
  { r: 6, c: 11 },
  { r: 6, c: 12, safe: true }, // 21 (Safe Star)
  { r: 6, c: 13 },
  { r: 6, c: 14 },
  { r: 7, c: 14 },
  { r: 8, c: 14 },
  // Green starts at (8, 13)
  { r: 8, c: 13, safe: true }, // 26 (Green Start)
  { r: 8, c: 12 },
  { r: 8, c: 11 },
  { r: 8, c: 10 },
  { r: 8, c: 9 },
  { r: 9, c: 8 },
  { r: 10, c: 8 },
  { r: 11, c: 8 },
  { r: 12, c: 8, safe: true }, // 34 (Safe Star)
  { r: 13, c: 8 },
  { r: 14, c: 8 },
  { r: 14, c: 7 },
  { r: 14, c: 6 },
  { r: 13, c: 6, safe: true }, // 39 (Blue Start Star)
  { r: 12, c: 6 },
  { r: 11, c: 6 },
  { r: 10, c: 6 },
  { r: 9, c: 6 },
  { r: 8, c: 5 },
  { r: 8, c: 4 },
  { r: 8, c: 3 },
  { r: 8, c: 2, safe: true }, // 47 (Safe Star)
  { r: 8, c: 1 },
  { r: 8, c: 0 },
  { r: 7, c: 0 },
  { r: 6, c: 0 }, // 51 (Last step before entering Red home runway)
];

// Red Home Runway (51..55) & Goal (56)
const RED_HOME_RUNWAY = [
  { r: 7, c: 1 },
  { r: 7, c: 2 },
  { r: 7, c: 3 },
  { r: 7, c: 4 },
  { r: 7, c: 5 },
  { r: 7, c: 6 }, // 56 (Center Goal)
];

// Green Home Runway (51..55) & Goal (56)
const GREEN_HOME_RUNWAY = [
  { r: 7, c: 13 },
  { r: 7, c: 12 },
  { r: 7, c: 11 },
  { r: 7, c: 10 },
  { r: 7, c: 9 },
  { r: 7, c: 8 }, // 56 (Center Goal)
];

// Base Pocket Positions (Row, Col relative to 15x15)
const RED_BASE_SLOTS = [
  { r: 1.5, c: 1.5 },
  { r: 1.5, c: 3.5 },
  { r: 3.5, c: 1.5 },
  { r: 3.5, c: 3.5 },
];

const GREEN_BASE_SLOTS = [
  { r: 10.5, c: 10.5 },
  { r: 10.5, c: 12.5 },
  { r: 12.5, c: 10.5 },
  { r: 12.5, c: 12.5 },
];

interface LudoChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: number;
}

const QUICK_CHATS = [
  '👋 Hi!',
  '🎲 Good luck!',
  '🔥 Nice move!',
  '⚡ Hurry up!',
  '😂 Haha!',
  '😱 OMG!',
  '👏 Well played!',
  '🤝 Rematch?',
];

export const LudoGameModal: React.FC = () => {
  const { currentUser, activeLudoGameId, setActiveLudoGameId } = useStore();
  const [game, setGame] = useState<any>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);

  // ⏱️ 30-Second Turn Countdown Timer State
  const [timeLeft, setTimeLeft] = useState<number>(30);

  // 💬 In-Game Live Text Chat States
  const [chatMessages, setChatMessages] = useState<LudoChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'game' | 'chat'>('game');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [speechBubbles, setSpeechBubbles] = useState<Record<string, { text: string; id: number }>>({});
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // 🎙️ Real-Time In-Game WebRTC Voice Chat States (Studio Master Quality)
  const [isMicOn, setIsMicOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isOpponentMuted, setIsOpponentMuted] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioPlayerRef = useRef<RemoteAudioPlayer | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Derived Players
  const myPlayer = game?.players ? game.players[currentUser?.id || ''] : null;
  const opponentId = game?.playerOrder?.find((id: string) => id !== currentUser?.id);
  const opponentPlayer = opponentId && game?.players ? game.players[opponentId] : null;
  const isMyTurn = game && game.currentTurn === currentUser?.id;

  // ⏱️ 30s Turn Timer Sync
  useEffect(() => {
    if (!game?.turnDeadline) {
      setTimeLeft(30);
      return;
    }
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((game.turnDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 250);
    return () => clearInterval(interval);
  }, [game?.turnDeadline]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (activeTab === 'chat' || isChatOpen) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isChatOpen]);

  // ── 1. SOCKET SYNC FOR GAMEPLAY & IN-GAME CHAT ────────────────────
  useEffect(() => {
    if (!activeLudoGameId) return;

    const socket = getSocket();
    socket.emit('ludo:join_room', { gameId: activeLudoGameId });

    socket.on('ludo:game_started', ({ game }: any) => {
      setGame(game);
    });

    socket.on('ludo:sync_state', (syncedGame: any) => {
      setGame(syncedGame);
    });

    socket.on('ludo:dice_rolled', ({ diceValue, turn, movableTokens, lastAction, turnDeadline }: any) => {
      setIsRolling(true);
      if (soundEnabled) playSynthesizedSound('dice');

      setTimeout(() => {
        setIsRolling(false);
        setGame((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            diceValue,
            hasRolled: true,
            movableTokens,
            lastAction,
            turnDeadline: turnDeadline || prev.turnDeadline,
          };
        });
      }, 120);
    });

    socket.on('ludo:state_updated', (updatedGame: any) => {
      setGame(updatedGame);
      if (soundEnabled) {
        if (updatedGame.winner) {
          playSynthesizedSound('win');
        } else if (updatedGame.lastAction.includes('captured') || updatedGame.lastAction.includes('cut')) {
          playSynthesizedSound('capture');
        } else {
          playSynthesizedSound('move');
        }
      }
    });

    socket.on('ludo:new_chat', (msg: LudoChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      // Show floating speech bubble over player avatar
      setSpeechBubbles((prev) => ({
        ...prev,
        [msg.senderId]: { text: msg.text, id: Date.now() },
      }));
      setTimeout(() => {
        setSpeechBubbles((prev) => {
          if (prev[msg.senderId]?.text === msg.text) {
            const next = { ...prev };
            delete next[msg.senderId];
            return next;
          }
          return prev;
        });
      }, 4500);

      // Increment unread count if user is not in chat tab
      setUnreadChatCount((count) => count + 1);
    });

    return () => {
      socket.off('ludo:game_started');
      socket.off('ludo:sync_state');
      socket.off('ludo:dice_rolled');
      socket.off('ludo:state_updated');
      socket.off('ludo:new_chat');
    };
  }, [activeLudoGameId, soundEnabled]);

  const handleSendChat = (customText?: string) => {
    const textToSend = (customText || chatInput).trim();
    if (!textToSend || !activeLudoGameId) return;
    const socket = getSocket();
    socket.emit('ludo:send_chat', {
      gameId: activeLudoGameId,
      text: textToSend,
    });
    if (!customText) {
      setChatInput('');
    }
  };

  // ── 2. WEBRTC VOICE SIGNALING LISTENERS ─────────────────────────
  useEffect(() => {
    if (!activeLudoGameId) return;
    const socket = getSocket();

    const handleVoiceOffer = async ({ fromUserId, offer }: any) => {
      try {
        console.log('[Ludo Voice] Received incoming voice offer from:', fromUserId);
        const pc = getOrCreatePeerConnection(fromUserId);
        const tunedOffer = {
          type: offer.type,
          sdp: tuneOpusSDP(offer.sdp || ''),
        };
        await pc.setRemoteDescription(new RTCSessionDescription(tunedOffer));

        // Flush queued ICE
        while (iceCandidatesQueueRef.current.length > 0) {
          const cand = iceCandidatesQueueRef.current.shift();
          if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }

        const answer = await pc.createAnswer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(answer);

        // Boost audio senders to 128kbps Studio Master Opus
        pc.getSenders().forEach((sender) => {
          if (sender.track?.kind === 'audio') {
            const params = sender.getParameters();
            if (params && params.encodings) {
              params.encodings.forEach((enc) => {
                enc.maxBitrate = 128000;
                // @ts-ignore
                enc.priority = 'high';
                // @ts-ignore
                enc.networkPriority = 'high';
              });
              sender.setParameters(params).catch(() => {});
            }
          }
        });

        const tunedAnswer = {
          type: answer.type,
          sdp: tuneOpusSDP(answer.sdp || pc.localDescription?.sdp || ''),
        };

        socket.emit('ludo:voice_answer', {
          gameId: activeLudoGameId,
          targetUserId: fromUserId,
          answer: tunedAnswer,
        });
        setIsVoiceConnected(true);
      } catch (err) {
        console.error('[Ludo Voice] Error handling offer:', err);
      }
    };

    const handleVoiceAnswer = async ({ fromUserId, answer }: any) => {
      try {
        console.log('[Ludo Voice] Received voice answer from:', fromUserId);
        const pc = peerConnectionRef.current;
        if (pc) {
          const tunedAnswer = {
            type: answer.type,
            sdp: tuneOpusSDP(answer.sdp || ''),
          };
          await pc.setRemoteDescription(new RTCSessionDescription(tunedAnswer));
          setIsVoiceConnected(true);

          while (iceCandidatesQueueRef.current.length > 0) {
            const cand = iceCandidatesQueueRef.current.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[Ludo Voice] Error handling answer:', err);
      }
    };

    const handleVoiceIce = async ({ candidate }: any) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidatesQueueRef.current.push(candidate);
        }
      } catch (err) {
        console.error('[Ludo Voice] Error handling ICE:', err);
      }
    };

    const handleVoiceStatus = ({ isMuted }: any) => {
      setIsOpponentMuted(isMuted);
    };

    socket.on('ludo:voice_offer', handleVoiceOffer);
    socket.on('ludo:voice_answer', handleVoiceAnswer);
    socket.on('ludo:voice_ice', handleVoiceIce);
    socket.on('ludo:voice_status', handleVoiceStatus);

    return () => {
      socket.off('ludo:voice_offer', handleVoiceOffer);
      socket.off('ludo:voice_answer', handleVoiceAnswer);
      socket.off('ludo:voice_ice', handleVoiceIce);
      socket.off('ludo:voice_status', handleVoiceStatus);
    };
  }, [activeLudoGameId, opponentId]);

  // Clean up WebRTC on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      audioPlayerRef.current?.close();
      audioPlayerRef.current = null;
    };
  }, []);

  // ── 3. WEBRTC HELPER & TOGGLES (STUDIO MASTER QUALITY) ───────────
  const getOrCreatePeerConnection = (targetUserId: string): RTCPeerConnection => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(GLOBAL_RTC_CONFIGURATION);
    peerConnectionRef.current = pc;

    // Attach local stream tracks if already captured
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      console.log('🎙️ [Ludo Voice] Remote audio stream received:', event.track.id, event.track.kind);
      let streamToPlay = event.streams && event.streams[0] ? event.streams[0] : null;
      if (!streamToPlay || streamToPlay.getAudioTracks().length === 0) {
        streamToPlay = new MediaStream([event.track]);
      } else if (!streamToPlay.getTracks().some((t) => t.id === event.track.id)) {
        streamToPlay.addTrack(event.track);
      }

      if (streamToPlay && streamToPlay.getAudioTracks().length > 0) {
        // 🔒 Primary Native Hardware Playout: Direct browser media engine (100% continuous, zero drops, 1+ hour continuous crystal clear sound)
        if (remoteAudioRef.current) {
          if (remoteAudioRef.current.srcObject !== streamToPlay) {
            remoteAudioRef.current.srcObject = streamToPlay;
          }
          remoteAudioRef.current.muted = !isSpeakerOn;
          remoteAudioRef.current.play().catch(() => {});
        }
        setIsVoiceConnected(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        const candidateData = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment,
        };
        socket.emit('ludo:voice_ice', {
          gameId: activeLudoGameId,
          targetUserId,
          candidate: candidateData,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 [Ludo Voice] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsVoiceConnected(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsVoiceConnected(false);
      }
    };

    return pc;
  };

  const toggleMic = async () => {
    const targetUserId = opponentId || opponentPlayer?.userId || (game?.playerOrder ? game.playerOrder.find((id: string) => id !== currentUser?.id) : undefined);
    console.log('🎤 [Ludo Voice] toggleMic clicked. targetUserId:', targetUserId, 'current isMicOn:', isMicOn);
    if (!targetUserId) {
      console.warn('⚠️ [Ludo Voice] Cannot toggle mic, opponent user ID not resolved yet');
      return;
    }

    setVoiceError(null);

    // If mic is currently ON -> turn it OFF
    if (isMicOn) {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
      setIsMicOn(false);
      const socket = getSocket();
      socket.emit('ludo:voice_status', {
        gameId: activeLudoGameId,
        targetUserId,
        isMuted: true,
      });
      return;
    }

    // If mic is currently OFF -> turn it ON with Studio Constraints
    try {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: HIGH_QUALITY_AUDIO_CONSTRAINTS,
          video: false,
        });
        localStreamRef.current = stream;
      } else {
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
      }

      setIsMicOn(true);

      const pc = getOrCreatePeerConnection(targetUserId);

      // Add tracks if not added yet
      const senders = pc.getSenders();
      stream.getAudioTracks().forEach((track) => {
        const hasTrack = senders.some((s) => s.track?.id === track.id);
        if (!hasTrack) {
          pc.addTrack(track, stream!);
        }
      });

      // Create and dispatch offer with 128kbps Opus Master tuning
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio') {
          const params = sender.getParameters();
          if (params && params.encodings) {
            params.encodings.forEach((enc) => {
              enc.maxBitrate = 128000;
              // @ts-ignore
              enc.priority = 'high';
              // @ts-ignore
              enc.networkPriority = 'high';
            });
            sender.setParameters(params).catch(() => {});
          }
        }
      });

      const tunedOffer = {
        type: offer.type,
        sdp: tuneOpusSDP(offer.sdp || pc.localDescription?.sdp || ''),
      };

      const socket = getSocket();
      socket.emit('ludo:voice_offer', {
        gameId: activeLudoGameId,
        targetUserId,
        offer: tunedOffer,
      });
      socket.emit('ludo:voice_status', {
        gameId: activeLudoGameId,
        targetUserId,
        isMuted: false,
      });
    } catch (err: any) {
      console.error('[Ludo Voice] Failed to get microphone:', err);
      setVoiceError('Microphone permission required for in-game voice call.');
      setIsMicOn(false);
    }
  };

  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !next;
    }
  };

  // ── 4. GAME ACTIONS ─────────────────────────────────────────────
  if (!activeLudoGameId) return null;

  const handleRollDice = () => {
    audioPlayerRef.current?.resume();
    if (!game || game.winner) return;
    if (game.currentTurn !== currentUser?.id) return;
    if (game.hasRolled || isRolling) return;

    setIsRolling(true);
    if (soundEnabled) playSynthesizedSound('dice');

    const socket = getSocket();
    socket.emit('ludo:roll_dice', { gameId: activeLudoGameId });
  };

  const handleMoveToken = (tokenIndex: number) => {
    audioPlayerRef.current?.resume();
    if (!game || game.winner) return;
    if (game.currentTurn !== currentUser?.id) return;
    if (!game.hasRolled || !game.diceValue) return;
    if (!game.movableTokens?.includes(tokenIndex)) return;

    if (soundEnabled) playSynthesizedSound('move');

    // Optimistic UI update
    const currentPos = myPlayer?.tokens[tokenIndex] ?? -1;
    const nextPos = currentPos === -1 ? 0 : currentPos + game.diceValue;

    setGame((prev: any) => {
      if (!prev || !currentUser?.id) return prev;
      const updatedTokens = [...prev.players[currentUser.id].tokens];
      updatedTokens[tokenIndex] = nextPos;
      return {
        ...prev,
        hasRolled: false,
        movableTokens: [],
        players: {
          ...prev.players,
          [currentUser.id]: {
            ...prev.players[currentUser.id],
            tokens: updatedTokens,
          },
        },
      };
    });

    const socket = getSocket();
    socket.emit('ludo:move_token', { gameId: activeLudoGameId, tokenIndex });
  };

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to exit this Ludo match?')) {
      const socket = getSocket();
      socket.emit('ludo:leave', { gameId: activeLudoGameId });
      setActiveLudoGameId(null);
    }
  };

  const triggerReaction = (emoji: string) => {
    const id = Date.now();
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 1500);
  };

  // ── 5. DICE FACE RENDERER ───────────────────────────────────────
  const renderDiceFace = (val: number | null) => {
    if (!val) return <span className="text-2xl font-bold text-slate-300">🎲</span>;

    const pips: Record<number, number[][]> = {
      1: [[1, 1]],
      2: [
        [0, 0],
        [2, 2],
      ],
      3: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
      4: [
        [0, 0],
        [0, 2],
        [2, 0],
        [2, 2],
      ],
      5: [
        [0, 0],
        [0, 2],
        [1, 1],
        [2, 0],
        [2, 2],
      ],
      6: [
        [0, 0],
        [0, 2],
        [1, 0],
        [1, 2],
        [2, 0],
        [2, 2],
      ],
    };

    const currentPips = pips[val] || [];

    return (
      <div className="grid grid-cols-3 grid-rows-3 w-12 h-12 p-2 gap-1.5 bg-gradient-to-tr from-white to-slate-100 rounded-2xl shadow-xl border-2 border-slate-300">
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => {
            const hasPip = currentPips.some(([pr, pc]) => pr === r && pc === c);
            return (
              <div key={`${r}-${c}`} className="flex items-center justify-center">
                {hasPip && (
                  <span
                    className={`w-2 h-2 rounded-full shadow-sm ${
                      val === 6 ? 'bg-rose-600' : val === 1 ? 'bg-indigo-600' : 'bg-slate-900'
                    }`}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  // Helper: Get grid cell coordinate for token
  const getTokenCellCoord = (color: 'RED' | 'GREEN', pos: number, tokenIdx: number) => {
    if (pos === -1) {
      return color === 'RED' ? RED_BASE_SLOTS[tokenIdx] : GREEN_BASE_SLOTS[tokenIdx];
    }
    if (color === 'RED') {
      if (pos >= 0 && pos <= 50) return MAIN_TRACK_COORDS[pos];
      if (pos >= 51 && pos <= 56) return RED_HOME_RUNWAY[pos - 51];
    } else {
      if (pos >= 0 && pos <= 50) {
        const globalIdx = (pos + 26) % 52;
        return MAIN_TRACK_COORDS[globalIdx];
      }
      if (pos >= 51 && pos <= 56) return GREEN_HOME_RUNWAY[pos - 51];
    }
    return { r: 7, c: 7 };
  };

  // ── 6. 15x15 REAL-LIFE LUDO TRACK CELLS GENERATOR ───────────────
  const trackCells = useMemo(() => {
    const cells: {
      r: number;
      c: number;
      isRedRunway: boolean;
      isGreenRunway: boolean;
      isYellowRunway: boolean;
      isBlueRunway: boolean;
      isRedStart: boolean;
      isGreenStart: boolean;
      isStar: boolean;
    }[] = [];

    const starCoords = new Set([
      '6,1', // Red Start
      '2,6', // Safe
      '1,8', // Yellow Start
      '6,12', // Safe
      '8,13', // Green Start
      '12,8', // Safe
      '13,6', // Blue Start
      '8,2', // Safe
    ]);

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Exclude 4 Bases and 3x3 Center Home
        const isTopLeft = r < 6 && c < 6;
        const isTopRight = r < 6 && c > 8;
        const isBottomLeft = r > 8 && c < 6;
        const isBottomRight = r > 8 && c > 8;
        const isCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;

        if (!isTopLeft && !isTopRight && !isBottomLeft && !isBottomRight && !isCenter) {
          const key = `${r},${c}`;
          cells.push({
            r,
            c,
            isRedRunway: r === 7 && c >= 1 && c <= 5,
            isGreenRunway: r === 7 && c >= 9 && c <= 13,
            isYellowRunway: c === 7 && r >= 1 && r <= 5,
            isBlueRunway: c === 7 && r >= 9 && r <= 13,
            isRedStart: r === 6 && c === 1,
            isGreenStart: r === 8 && c === 13,
            isStar: starCoords.has(key),
          });
        }
      }
    }
    return cells;
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Hidden Audio Player for Remote Opponent Voice */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="relative w-full max-w-5xl bg-[#0B0F19] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* TOP HEADER: Game Title, In-Game Voice Call Controls, Mute & Exit */}
        <div className="px-4 sm:px-6 py-3 border-b border-white/[0.08] bg-[#111726]/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
          {/* Left Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500 via-amber-500 to-emerald-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-rose-500/20">
              🎲
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-white">Classic Ludo Arena</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Match
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Authentic 15×15 Board with Real-Time Audio Voice Chat</p>
            </div>
          </div>

          {/* Center/Right: Live Voice Chat Bar & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-time Voice Chat Controls */}
            <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1 rounded-2xl">
              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleMic}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isMicOn
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 animate-pulse'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                }`}
                title={isMicOn ? 'Click to Mute Microphone' : 'Click to Turn On Mic & Voice Call'}
              >
                {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                <span className="text-[11px]">{isMicOn ? 'Mic On' : 'Mic Off'}</span>
              </button>

              {/* Speaker Toggle Button */}
              <button
                type="button"
                onClick={toggleSpeaker}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  isSpeakerOn
                    ? 'text-emerald-400 hover:bg-white/5'
                    : 'text-slate-500 bg-rose-500/10 hover:bg-rose-500/20'
                }`}
                title={isSpeakerOn ? 'Mute Incoming Voice' : 'Unmute Speaker'}
              >
                {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
              </button>

              {/* Voice status pill */}
              <div
                className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold ${
                  isVoiceConnected
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-400 bg-white/5'
                }`}
              >
                <Radio className={`w-3 h-3 ${isVoiceConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <span>{isVoiceConnected ? 'Voice Connected' : 'Voice Ready'}</span>
              </div>
            </div>

            {/* In-Game Text Chat Header Button */}
            <button
              type="button"
              onClick={() => {
                setActiveTab(activeTab === 'chat' ? 'game' : 'chat');
                setUnreadChatCount(0);
              }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
              }`}
              title="Open In-Game Text Chat"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] hidden sm:inline">Chat</span>
              {unreadChatCount > 0 && activeTab !== 'chat' && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black animate-bounce shadow">
                  {unreadChatCount}
                </span>
              )}
            </button>

            {/* Sound FX Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              title={soundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Exit Match */}
            <button
              onClick={handleLeaveGame}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Voice Error Notice if mic blocked */}
        {voiceError && (
          <div className="px-4 py-1.5 bg-rose-500/20 border-b border-rose-500/30 text-[11px] text-rose-200 text-center font-medium">
            ⚠️ {voiceError}
          </div>
        )}

        {/* PLAYERS VERSUS BAR: Avatar, Turn Indicators, 30s Timer and Mic Status */}
        <div className="px-4 sm:px-6 py-2 bg-[#0E1422] border-b border-white/[0.06] flex items-center justify-between gap-3 text-xs relative">
          {/* Player 1 (Red - You) */}
          <div
            className={`relative flex items-center gap-2.5 p-1.5 px-3 rounded-2xl transition-all ${
              game?.currentTurn === myPlayer?.userId
                ? 'bg-rose-500/15 border border-rose-500/40 ring-2 ring-rose-500/30 shadow-lg shadow-rose-950/50'
                : 'opacity-80'
            }`}
          >
            {/* Floating Speech Bubble for Red (You) */}
            {speechBubbles[myPlayer?.userId] && (
              <div className="absolute -top-7 left-1 z-30 bg-slate-900 border border-rose-500 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-xl flex items-center gap-1 max-w-[180px] animate-bounce">
                <span>💬</span>
                <span className="truncate">{speechBubbles[myPlayer?.userId]?.text}</span>
              </div>
            )}
            <div className="relative shrink-0">
              <UserAvatar
                avatarUrl={myPlayer?.avatarUrl}
                name={myPlayer?.displayName}
                size="sm"
                className="border-2 border-rose-500"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-[8px] text-white flex items-center justify-center font-bold shadow-sm">
                🔴
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-extrabold text-white text-xs leading-none">
                  {myPlayer?.displayName || 'You'} (Red)
                </p>
                {isMicOn ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Your mic is active" />
                ) : (
                  <span title="Your mic is muted"><MicOff className="w-2.5 h-2.5 text-slate-500" /></span>
                )}
              </div>
              <p className="text-[10px] text-rose-300 font-semibold mt-1">
                {game?.currentTurn === myPlayer?.userId ? '👉 Your Turn to Roll!' : 'Waiting...'}
              </p>
            </div>
          </div>

          {/* Versus Center Badge & 30s Turn Timer */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-amber-400 font-black text-[11px] uppercase tracking-wider">
                <Swords className="w-3 h-3" />
                <span>VS</span>
              </div>
              {/* 30s Countdown Timer Badge */}
              <div
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold transition-all ${
                  timeLeft <= 5
                    ? 'bg-rose-500/25 border-rose-500 text-rose-300 animate-pulse ring-2 ring-rose-500/50'
                    : timeLeft <= 10
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}
                title="30s Turn Timer (Auto-plays on timeout)"
              >
                <Clock className={`w-3 h-3 ${timeLeft <= 5 ? 'text-rose-400 animate-spin' : 'text-slate-400'}`} />
                <span>{timeLeft}s</span>
              </div>
            </div>
          </div>

          {/* Player 2 (Green - Opponent) */}
          <div
            className={`relative flex items-center gap-2.5 p-1.5 px-3 rounded-2xl transition-all ${
              game?.currentTurn === opponentPlayer?.userId
                ? 'bg-emerald-500/15 border border-emerald-500/40 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/50'
                : 'opacity-80'
            }`}
          >
            {/* Floating Speech Bubble for Green (Opponent) */}
            {speechBubbles[opponentPlayer?.userId] && (
              <div className="absolute -top-7 right-1 z-30 bg-slate-900 border border-emerald-500 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-xl flex items-center gap-1 max-w-[180px] animate-bounce">
                <span>💬</span>
                <span className="truncate">{speechBubbles[opponentPlayer?.userId]?.text}</span>
              </div>
            )}
            <div>
              <div className="flex items-center justify-end gap-1.5">
                {!isOpponentMuted ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Opponent speaking" />
                ) : (
                  <span title="Opponent mic muted"><MicOff className="w-2.5 h-2.5 text-slate-500" /></span>
                )}
                <p className="font-extrabold text-white text-xs leading-none text-right">
                  {opponentPlayer?.displayName || 'Opponent'} (Green)
                </p>
              </div>
              <p className="text-[10px] text-emerald-300 font-semibold mt-1 text-right">
                {game?.currentTurn === opponentPlayer?.userId ? '👉 Opponent Rolling...' : 'Waiting...'}
              </p>
            </div>
            <div className="relative shrink-0">
              <UserAvatar
                avatarUrl={opponentPlayer?.avatarUrl}
                name={opponentPlayer?.displayName}
                size="sm"
                className="border-2 border-emerald-500"
              />
              <span className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-[8px] text-white flex items-center justify-center font-bold shadow-sm">
                🟢
              </span>
            </div>
          </div>
        </div>

        {/* 30-Second Turn Countdown Progress Line */}
        <div className="w-full bg-slate-900/90 h-1 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-linear ${
              timeLeft <= 5
                ? 'bg-rose-500 shadow-sm shadow-rose-500'
                : timeLeft <= 10
                ? 'bg-amber-400 shadow-sm shadow-amber-400'
                : game?.currentTurn === myPlayer?.userId
                ? 'bg-rose-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, (timeLeft / 30) * 100))}%` }}
          />
        </div>

        {/* Live Commentary Bar */}
        <div className="px-4 py-1.5 bg-[#090D16] text-center border-b border-white/[0.06] text-xs font-semibold text-amber-300 flex items-center justify-center gap-2 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{game?.lastAction || 'Match started! Roll the dice to begin...'}</span>
        </div>

        {/* MAIN GAMEPLAY ARENA: Authentic 15x15 Ludo Board + Controls */}
        <div className="flex-1 p-3 sm:p-5 flex flex-col lg:flex-row items-center justify-center gap-6 overflow-y-auto">
          {/* AUTHENTIC 15x15 LUDO BOARD (Pixel-Perfect Square CSS Grid) */}
          <div className="relative w-full max-w-[340px] sm:max-w-[420px] md:max-w-[460px] aspect-square bg-[#0F172A] p-1.5 sm:p-2.5 rounded-3xl shadow-2xl border-4 border-slate-700/80 aspect-square select-none">
            {/* 15x15 Grid Layout with 100% exact sizing */}
            <div
              className="w-full h-full rounded-2xl overflow-hidden relative shadow-inner border border-slate-500"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
                backgroundColor: '#CBD5E1', // crisp thin borders between cells
                gap: '1px',
              }}
            >
              {/* 1. TOP-LEFT RED HOME BASE (6x6 cells: row 1-6, col 1-6) */}
              <div
                style={{ gridArea: '1 / 1 / 7 / 7' }}
                className="bg-[#E11D48] p-2 sm:p-3 flex items-center justify-center relative shadow-md"
              >
                <span className="absolute top-1 left-2 text-[9px] font-black text-rose-200 tracking-wider">
                  RED
                </span>
                <div className="w-full h-full bg-white rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 shadow-inner border-2 border-rose-300">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const isTokenHere = myPlayer?.tokens[slotIdx] === -1;
                    const canMoveThis = isMyTurn && game?.hasRolled && game?.movableTokens?.includes(slotIdx);
                    return (
                      <div
                        key={`red-base-${slotIdx}`}
                        onClick={() => canMoveThis && handleMoveToken(slotIdx)}
                        className={`w-full h-full rounded-full bg-rose-50 border-2 border-rose-400 flex items-center justify-center transition-all ${
                          canMoveThis ? 'cursor-pointer animate-bounce ring-4 ring-amber-400 shadow-lg' : ''
                        }`}
                      >
                        {isTokenHere && (
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-rose-700 via-rose-600 to-rose-400 border-2 border-white shadow-xl flex items-center justify-center text-white text-[10px] font-black">
                            🔴
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. TOP-RIGHT YELLOW HOME BASE (6x6 cells: row 1-6, col 10-15) */}
              <div
                style={{ gridArea: '1 / 10 / 7 / 16' }}
                className="bg-[#EAB308] p-2 sm:p-3 flex items-center justify-center relative shadow-md"
              >
                <span className="absolute top-1 right-2 text-[9px] font-black text-amber-950/70 tracking-wider">
                  YELLOW
                </span>
                <div className="w-full h-full bg-white rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 shadow-inner border-2 border-amber-300">
                  {[0, 1, 2, 3].map((slotIdx) => (
                    <div
                      key={`yellow-base-${slotIdx}`}
                      className="w-full h-full rounded-full bg-amber-50 border-2 border-amber-400 flex items-center justify-center shadow-inner"
                    >
                      <div className="w-4 h-4 rounded-full bg-amber-200/50 border border-amber-300" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. BOTTOM-LEFT BLUE HOME BASE (6x6 cells: row 10-15, col 1-6) */}
              <div
                style={{ gridArea: '10 / 1 / 16 / 7' }}
                className="bg-[#2563EB] p-2 sm:p-3 flex items-center justify-center relative shadow-md"
              >
                <span className="absolute bottom-1 left-2 text-[9px] font-black text-blue-200 tracking-wider">
                  BLUE
                </span>
                <div className="w-full h-full bg-white rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 shadow-inner border-2 border-blue-300">
                  {[0, 1, 2, 3].map((slotIdx) => (
                    <div
                      key={`blue-base-${slotIdx}`}
                      className="w-full h-full rounded-full bg-blue-50 border-2 border-blue-400 flex items-center justify-center shadow-inner"
                    >
                      <div className="w-4 h-4 rounded-full bg-blue-200/50 border border-blue-300" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. BOTTOM-RIGHT GREEN HOME BASE (6x6 cells: row 10-15, col 10-15) */}
              <div
                style={{ gridArea: '10 / 10 / 16 / 16' }}
                className="bg-[#10B981] p-2 sm:p-3 flex items-center justify-center relative shadow-md"
              >
                <span className="absolute bottom-1 right-2 text-[9px] font-black text-emerald-200 tracking-wider">
                  GREEN
                </span>
                <div className="w-full h-full bg-white rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 shadow-inner border-2 border-emerald-300">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const isTokenHere = opponentPlayer?.tokens[slotIdx] === -1;
                    return (
                      <div
                        key={`green-base-${slotIdx}`}
                        className="w-full h-full rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center shadow-inner"
                      >
                        {isTokenHere && (
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-emerald-800 via-emerald-600 to-emerald-400 border-2 border-white shadow-xl flex items-center justify-center text-white text-[10px] font-black">
                            🟢
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. CENTER 3x3 FINISH HOME (Row 7-9, Col 7-9) */}
              <div
                style={{ gridArea: '7 / 7 / 10 / 10' }}
                className="relative bg-slate-900 overflow-hidden flex items-center justify-center shadow-inner border border-slate-600"
              >
                {/* 4 Classic Center Triangles */}
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)',
                    backgroundColor: '#E11D48',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                    backgroundColor: '#EAB308',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: 'polygon(100% 0%, 100% 100%, 0% 50%)',
                    backgroundColor: '#10B981',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: 'polygon(0% 100%, 100% 100%, 50% 0%)',
                    backgroundColor: '#2563EB',
                  }}
                />

                {/* Center Winner Crest */}
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center shadow-2xl border-2 border-amber-400 z-10">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 fill-amber-400" />
                </div>
              </div>

              {/* 6. ALL 72 TRACK CELLS (Authentic Individual Cells with Star Markers) */}
              {trackCells.map((cell) => {
                let bgStyle = 'bg-white';
                let content: React.ReactNode = null;

                if (cell.isRedRunway) {
                  bgStyle = 'bg-[#E11D48]';
                } else if (cell.isGreenRunway) {
                  bgStyle = 'bg-[#10B981]';
                } else if (cell.isYellowRunway) {
                  bgStyle = 'bg-[#EAB308]';
                } else if (cell.isBlueRunway) {
                  bgStyle = 'bg-[#2563EB]';
                } else if (cell.isRedStart) {
                  bgStyle = 'bg-[#E11D48]';
                  content = <ArrowRight className="w-3 h-3 text-white stroke-[3]" />;
                } else if (cell.isGreenStart) {
                  bgStyle = 'bg-[#10B981]';
                  content = <ArrowLeft className="w-3 h-3 text-white stroke-[3]" />;
                } else if (cell.isStar) {
                  content = <Star className="w-3 h-3 text-amber-500 fill-amber-400" />;
                }

                return (
                  <div
                    key={`cell-${cell.r}-${cell.c}`}
                    style={{
                      gridRow: cell.r + 1,
                      gridColumn: cell.c + 1,
                    }}
                    className={`w-full h-full flex items-center justify-center transition-colors ${bgStyle}`}
                  >
                    {content}
                  </div>
                );
              })}

              {/* 7. ACTIVE TOKENS ON TRACK (Red Player) */}
              {myPlayer?.tokens.map((pos: number, tokenIdx: number) => {
                if (pos === -1) return null; // Rendered in base yard
                const coord = getTokenCellCoord('RED', pos, tokenIdx);
                const canMoveThis = isMyTurn && game?.hasRolled && game?.movableTokens?.includes(tokenIdx);

                return (
                  <div
                    key={`red-token-${tokenIdx}`}
                    onClick={() => canMoveThis && handleMoveToken(tokenIdx)}
                    style={{
                      position: 'absolute',
                      top: `${(coord.r / 15) * 100}%`,
                      left: `${(coord.c / 15) * 100}%`,
                      width: `${100 / 15}%`,
                      height: `${100 / 15}%`,
                    }}
                    className="flex items-center justify-center z-20 transition-all duration-300 select-none p-0.5"
                  >
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-rose-800 via-rose-600 to-rose-400 border-2 border-white shadow-xl flex items-center justify-center text-white text-[10px] font-black cursor-pointer transition-transform ${
                        canMoveThis
                          ? 'ring-4 ring-amber-400 shadow-amber-400/70 animate-bounce scale-110 z-30'
                          : 'hover:scale-105'
                      }`}
                    >
                      🔴
                    </div>
                  </div>
                );
              })}

              {/* 8. ACTIVE TOKENS ON TRACK (Green Opponent) */}
              {opponentPlayer?.tokens.map((pos: number, tokenIdx: number) => {
                if (pos === -1) return null; // Rendered in base yard
                const coord = getTokenCellCoord('GREEN', pos, tokenIdx);

                return (
                  <div
                    key={`green-token-${tokenIdx}`}
                    style={{
                      position: 'absolute',
                      top: `${(coord.r / 15) * 100}%`,
                      left: `${(coord.c / 15) * 100}%`,
                      width: `${100 / 15}%`,
                      height: `${100 / 15}%`,
                    }}
                    className="flex items-center justify-center z-20 transition-all duration-300 select-none p-0.5"
                  >
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-emerald-800 via-emerald-600 to-emerald-400 border-2 border-white shadow-xl flex items-center justify-center text-white text-[10px] font-black">
                      🟢
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Floating Reaction Emojis */}
            {floatingEmojis.map((e) => (
              <span
                key={e.id}
                className="absolute text-5xl animate-out fade-out slide-out-to-top duration-1000 pointer-events-none left-1/2 top-1/2 -translate-x-1/2 z-40"
              >
                {e.emoji}
              </span>
            ))}
          </div>

          {/* RIGHT SIDE: Dice Roller & Interactive Voice Chat Controls or Live Chat */}
          <div className="w-full max-w-xs flex flex-col gap-3">
            {/* Tab Switcher: Game Controls vs Live In-Game Chat */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#111726] border border-white/10 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab('game')}
                className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'game'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🎲 Controls</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('chat');
                  setUnreadChatCount(0);
                }}
                className={`relative py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
                {chatMessages.length > 0 && (
                  <span className="text-[10px] opacity-75">({chatMessages.length})</span>
                )}
                {unreadChatCount > 0 && activeTab !== 'chat' && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" />
                )}
              </button>
            </div>

            {/* TAB 1: GAMEPLAY CONTROLS, DICE & VOICE */}
            {activeTab === 'game' ? (
              <>
                {/* Interactive Voice Call In-Game Banner */}
                <div className="p-3.5 rounded-3xl bg-gradient-to-br from-[#111726] to-[#1A2338] border border-white/10 shadow-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                          isVoiceConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-none">In-Game Voice Call</h4>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {isVoiceConnected ? 'Audio connected with opponent' : 'Talk while you play!'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-2 h-2 rounded-full ${
                        isVoiceConnected ? 'bg-emerald-500 animate-ping' : 'bg-slate-600'
                      }`}
                    />
                  </div>

                  {/* Mic & Speaker Call Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={toggleMic}
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                        isMicOn
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-white/10 hover:bg-white/15 text-slate-300'
                      }`}
                    >
                      {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-rose-400" />}
                      <span>{isMicOn ? 'Mute Mic' : 'Turn On Mic'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleSpeaker}
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        isSpeakerOn
                          ? 'bg-white/10 hover:bg-white/15 text-white border-white/10'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {isSpeakerOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
                      <span>{isSpeakerOn ? 'Speaker On' : 'Speaker Off'}</span>
                    </button>
                  </div>
                </div>

                {/* Dice Roller Card with 30s Turn Timer */}
                <div className="p-4 rounded-3xl bg-[#111726] border border-white/10 shadow-xl flex flex-col items-center justify-center text-center">
                  {/* Turn Timer Badge */}
                  <div className="w-full flex items-center justify-between mb-3 px-2 py-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 text-amber-400" />
                      Turn Timer
                    </span>
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-lg border transition-all ${
                        timeLeft <= 5
                          ? 'bg-rose-500/25 border-rose-500 text-rose-300 animate-pulse'
                          : timeLeft <= 10
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-white/5 border-white/10 text-white'
                      }`}
                    >
                      ⏱️ {timeLeft}s auto-play
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-semibold mb-3">
                    {isMyTurn
                      ? game?.hasRolled
                        ? '🎯 Tap a highlighted token to move!'
                        : '👉 Your turn! Press below to roll dice'
                      : "⏳ Waiting for opponent's roll..."}
                  </p>

                  {/* 3D Dice */}
                  <button
                    type="button"
                    disabled={!isMyTurn || game?.hasRolled || isRolling}
                    onClick={handleRollDice}
                    className={`p-3.5 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 transition-all transform flex items-center justify-center shadow-2xl cursor-pointer ${
                      isMyTurn && !game?.hasRolled
                        ? 'border-rose-500 shadow-rose-950/70 hover:scale-105 active:scale-95 animate-pulse'
                        : 'border-white/10 opacity-80'
                    } ${isRolling ? 'rotate-180 duration-500' : ''}`}
                  >
                    {renderDiceFace(game?.diceValue)}
                  </button>

                  <button
                    type="button"
                    disabled={!isMyTurn || game?.hasRolled || isRolling}
                    onClick={handleRollDice}
                    className={`mt-4 w-full py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                      isMyTurn && !game?.hasRolled
                        ? 'bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white shadow-rose-500/30 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    <span>{isRolling ? 'Rolling Dice...' : '🎲 Roll Dice Now'}</span>
                  </button>
                </div>

                {/* Quick In-Game Text Messages (1-Tap Send) */}
                <div className="p-3 bg-[#111726]/80 rounded-2xl border border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                      Quick Message
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('chat');
                        setUnreadChatCount(0);
                      }}
                      className="text-[10px] text-blue-400 hover:underline font-bold cursor-pointer"
                    >
                      Full Chat →
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_CHATS.slice(0, 6).map((text) => (
                      <button
                        key={text}
                        type="button"
                        onClick={() => handleSendChat(text)}
                        className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white text-[11px] font-semibold transition-all border border-white/5 cursor-pointer shadow-sm"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Chat Reaction Emojis */}
                <div className="p-2.5 bg-[#111726]/60 rounded-2xl border border-white/10 flex items-center justify-around">
                  {['😂', '🔥', '👏', '🎯', '🚀'].map((em) => (
                    <button
                      key={em}
                      onClick={() => triggerReaction(em)}
                      className="text-xl hover:scale-125 transition-transform p-1 cursor-pointer select-none"
                    >
                      {em}
                    </button>
                  ))}
                </div>

                {/* Quick Rules */}
                <div className="p-3 bg-white/[0.02] rounded-2xl border border-white/[0.06] text-[11px] text-slate-400 space-y-1">
                  <p className="font-bold text-slate-300">📜 Ludo Rules & Timer:</p>
                  <p>• ⏱️ Each turn has a 30s limit; after 30s it auto-rolls and moves!</p>
                  <p>• Rolling a 6 moves a token out of base and grants an extra roll.</p>
                  <p>• Capturing an opponent token gives a bonus turn.</p>
                </div>
              </>
            ) : (
              /* TAB 2: FULL IN-GAME LIVE CHAT */
              <div className="flex flex-col h-[460px] bg-[#111726] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                {/* Chat Panel Header */}
                <div className="p-3 px-4 bg-[#141B2D] border-b border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white leading-none">In-Game Chat</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Chatting with {opponentPlayer?.displayName || 'Opponent'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('game')}
                    className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10"
                  >
                    Back to Dice
                  </button>
                </div>

                {/* Chat Messages List */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-30 text-blue-400" />
                      <p className="font-semibold text-xs text-slate-400">No messages yet</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Send a message or tap one of the quick chat pills below!
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMe = msg.senderId === currentUser?.id;
                      const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5 px-1">
                            <span className="text-[10px] font-bold text-slate-400">
                              {isMe ? 'You' : msg.senderName}
                            </span>
                            <span className="text-[9px] text-slate-500">{timeStr}</span>
                          </div>
                          <div
                            className={`max-w-[85%] px-3 py-1.5 rounded-2xl break-words text-xs shadow-md ${
                              isMe
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                                : 'bg-[#1C253B] text-slate-200 border border-white/10 rounded-tl-none'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Quick Chat Pills inside Chat Tab */}
                <div className="p-2 border-t border-white/[0.06] bg-[#0E1422] flex gap-1.5 overflow-x-auto no-scrollbar">
                  {QUICK_CHATS.map((qc) => (
                    <button
                      key={qc}
                      type="button"
                      onClick={() => handleSendChat(qc)}
                      className="shrink-0 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white text-[10px] font-semibold border border-white/5 cursor-pointer"
                    >
                      {qc}
                    </button>
                  ))}
                </div>

                {/* Message Input & Send Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="p-2.5 bg-[#141B2D] border-t border-white/[0.08] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type message here..."
                    className="flex-1 px-3 py-1.5 bg-[#0B0F19] text-white placeholder-slate-500 rounded-xl text-xs border border-white/10 focus:outline-none focus:border-blue-500"
                    maxLength={140}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      chatInput.trim()
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 active:scale-95'
                        : 'bg-white/5 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Winner Celebration Modal */}
        {game?.winner && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4">
              <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
            </div>
            <h3 className="text-2xl font-extrabold text-white mb-1">Victory! 🏆</h3>
            <p className="text-sm text-slate-300 max-w-sm mb-6 font-semibold">
              {game.players[game.winner]?.displayName || 'Player'} has won the match!
            </p>
            <button
              onClick={() => setActiveLudoGameId(null)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Exit Match
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
