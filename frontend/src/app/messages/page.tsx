'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { VideoCallModal } from '../../components/VideoCallModal';
import { CreateGroupModal } from '../../components/CreateGroupModal';
import { StartChatModal } from '../../components/StartChatModal';
import {
  Send,
  Phone,
  Video,
  Image as ImageIcon,
  Flame,
  Search,
  Users,
  Plus,
  MessageSquare,
  MessageCircle,
  MessageSquarePlus,
  Sparkles,
  Gamepad2,
  Lock,
  ArrowRight,
  Paperclip,
  FileText,
  Download,
  Mic,
  Play,
  Pause,
  X,
  Trash2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api, resolveMediaUrl } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { formatDate, formatLastActive } from '../../lib/utils';
import { UserAvatar } from '../../components/UserAvatar';
import { playMessageChime } from '../../lib/soundUtils';

interface MessageItem {
  id: string;
  conversationId?: string;
  senderId: string;
  sender?: {
    displayName?: string;
    avatarUrl?: string;
  };
  content?: string;
  mediaUrl?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'GIF';
  isDisappearing?: boolean;
  createdAt: string;
}

interface ChatItem {
  id: string;
  isGroup: boolean;
  name: string;
  avatarUrl: string;
  otherUser?: any;
  lastMessage?: any;
  isUnread?: boolean;
  updatedAt?: string;
  participants?: any[];
  isFriend?: boolean;
  isMessageRequest?: boolean;
}

// Helper to download any media/file reliably to client machine
const triggerDownload = async (mediaUrl: string, filename: string) => {
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) throw new Error('Download request failed');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    window.open(mediaUrl, '_blank');
  }
};

// ── Voice Message Player Bubble Component ──────────────────────────
const VoiceMessageBubble: React.FC<{ mediaUrl: string; isMe: boolean; durationText?: string }> = ({
  mediaUrl,
  isMe,
  durationText,
}) => {
  // Parse duration from text format "Voice message (0:05)"
  const parsedDuration = (() => {
    const match = durationText?.match(/\((\d+):(\d+)\)/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return 0;
  })();

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(parsedDuration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatSecs = (sec: number) => {
    if (isNaN(sec) || sec <= 0 || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getEffectiveDuration = () => {
    if (isFinite(totalDuration) && totalDuration > 0) return totalDuration;
    if (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      return audioRef.current.duration;
    }
    return parsedDuration > 0 ? parsedDuration : 1;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Audio play failed, retrying on fresh play:', err);
          setIsPlaying(false);
        });
    }
  };

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl min-w-[220px] max-w-[310px] ${
        isMe ? 'bg-white/10' : 'bg-black/25 border border-white/10'
      }`}
    >
      <audio
        ref={audioRef}
        src={mediaUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            const dur = audioRef.current.duration;
            if (isFinite(dur) && dur > 0) {
              setTotalDuration(dur);
            } else if (parsedDuration > 0) {
              setTotalDuration(parsedDuration);
            }
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            const cur = audioRef.current.currentTime;
            const dur = getEffectiveDuration();
            setCurrentTime(cur);
            setProgress(Math.min(100, (cur / dur) * 100));
            if (cur >= dur) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              setIsPlaying(false);
              setProgress(0);
              setCurrentTime(0);
            }
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
        onError={() => setIsPlaying(false)}
      />

      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
          isMe ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 ml-0.5 fill-current" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          onClick={(e) => {
            if (!audioRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            const dur = getEffectiveDuration();
            audioRef.current.currentTime = Math.max(0, Math.min(dur, clickPos * dur));
          }}
          className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden cursor-pointer relative"
        >
          <div
            className={`h-full transition-all rounded-full ${isMe ? 'bg-white' : 'bg-rose-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-white/70">
          <span>{formatSecs(currentTime)}</span>
          <div className="flex items-center gap-2">
            <span>{formatSecs(getEffectiveDuration())}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerDownload(mediaUrl, 'voice_message.webm');
              }}
              className="p-1 hover:bg-white/20 rounded text-white/80 hover:text-white transition-all cursor-pointer"
              title="Download voice note"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Document / File Message Bubble Component ───────────────────────
const DocumentMessageBubble: React.FC<{ mediaUrl: string; fileName?: string; isMe: boolean }> = ({
  mediaUrl,
  fileName,
  isMe,
}) => {
  const cleanName =
    fileName && !fileName.startsWith('Voice message')
      ? fileName
      : mediaUrl.split('/').pop() || 'Document';
  const ext = cleanName.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 rounded-2xl min-w-[220px] max-w-[340px] border transition-all ${
        isMe
          ? 'bg-white/10 border-white/20 text-white'
          : 'bg-[#141B2D] border-white/10 text-slate-100'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex flex-col items-center justify-center shrink-0 text-white shadow-md">
          <FileText className="w-5 h-5" />
          <span className="text-[7px] font-black uppercase tracking-wider -mt-0.5">
            {ext.slice(0, 4)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate leading-tight" title={cleanName}>{cleanName}</p>
          <span className="text-[10px] text-slate-400 block mt-0.5">Document File</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => triggerDownload(mediaUrl, cleanName)}
        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all shrink-0 cursor-pointer shadow-sm hover:scale-105 active:scale-95"
        title="Download file"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
};

function MessagesContent() {
  const searchParams = useSearchParams();
  const targetUserParam = searchParams.get('user') || searchParams.get('userId');

  const [mounted, setMounted] = useState(false);
  const {
    currentUser,
    fetchCurrentUser,
    setActiveCall,
    onlineUsers,
    userLastSeen,
    setUnreadMessagesCount,
  } = useStore();

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [vanishMode, setVanishMode] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isStartChatModalOpen, setIsStartChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [actionLoading, setActionLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatDocInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingChatFile, setIsUploadingChatFile] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = activeChatId;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ACTIVE_CHAT_ID = activeChatId;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__ACTIVE_CHAT_ID = null;
      }
    };
  }, [activeChatId]);

  // Voice message recording states
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);

  // Large file upload progress & message deletion states
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    setDeletingMessageId(messageId);
    try {
      const res = await api.delete(`/messages/${messageId}`);
      if (res.success) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChatId && c.lastMessage?.id === messageId
              ? { ...c, lastMessage: null }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Delete message error:', err);
    } finally {
      setDeletingMessageId(null);
    }
  };

  // Initialize & Global Real-time Message Listener (Guarantees zero dropped messages)
  useEffect(() => {
    setMounted(true);
    fetchCurrentUser();
    loadConversations();

    try {
      const socket = getSocket();

      const handleIncomingNotification = (data: any) => {
        loadConversations();
        if (data?.message) {
          if (data.message.senderId && data.message.senderId !== currentUser?.id) {
            playMessageChime();
          }
          if (data.conversationId === activeChatIdRef.current) {
            api.post(`/conversations/${data.conversationId}/read`).catch(() => {});
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
          }
        }
      };

      const handleGlobalNewMessage = (msg: any) => {
        if (msg?.conversationId) {
          const isCurrentlyActive = msg.conversationId === activeChatIdRef.current;
          if (isCurrentlyActive && msg.senderId !== currentUser?.id) {
            api.post(`/conversations/${msg.conversationId}/read`).catch(() => {});
          }

          setChats((prev) => {
            const exists = prev.some((c) => c.id === msg.conversationId);
            if (!exists) {
              loadConversations();
              return prev;
            }
            const updated = prev
              .map((c) =>
                c.id === msg.conversationId
                  ? {
                      ...c,
                      lastMessage: msg,
                      updatedAt: msg.createdAt || new Date().toISOString(),
                      isUnread: !isCurrentlyActive && msg.senderId !== currentUser?.id,
                    }
                  : c
              )
              .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

            const unreadCount = updated.filter((c) => c.isUnread).length;
            setUnreadMessagesCount(unreadCount);
            return updated;
          });

          if (isCurrentlyActive) {
            if (msg.senderId && msg.senderId !== currentUser?.id) {
              playMessageChime();
            }
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
          }
        }
      };

      const handleMessageDeleted = (data: { messageId: string; conversationId: string }) => {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
        setChats((prev) =>
          prev.map((c) =>
            c.id === data.conversationId && c.lastMessage?.id === data.messageId
              ? { ...c, lastMessage: null }
              : c
          )
        );
      };

      const handleSocketConnect = () => {
        if (activeChatIdRef.current) {
          socket.emit('chat:join', activeChatIdRef.current);
        }
      };

      socket.on('chat:incoming_notification', handleIncomingNotification);
      socket.on('chat:new_message', handleGlobalNewMessage);
      socket.on('chat:message_deleted', handleMessageDeleted);
      socket.on('connect', handleSocketConnect);

      return () => {
        socket.off('chat:incoming_notification', handleIncomingNotification);
        socket.off('chat:new_message', handleGlobalNewMessage);
        socket.off('chat:message_deleted', handleMessageDeleted);
        socket.off('connect', handleSocketConnect);
      };
    } catch (err) {
      console.error('Socket setup error:', err);
    }
  }, [currentUser?.id]);

  // When targetUserParam changes from URL (?user=id), select or create conversation
  useEffect(() => {
    if (!targetUserParam || loadingChats) return;

    const findAndActivate = async () => {
      const existing = chats.find(
        (c) =>
          !c.isGroup &&
          (c.otherUser?.id === targetUserParam ||
            c.participants?.some((p: any) => p.id === targetUserParam))
      );

      if (existing) {
        setActiveChatId(existing.id);
        messageInputRef.current?.focus();
      } else {
        try {
          const convRes = await api.post('/conversations', { recipientId: targetUserParam });
          if (convRes.success && convRes.data) {
            setChats((prev) => [convRes.data, ...prev.filter((c) => c.id !== convRes.data.id)]);
            setActiveChatId(convRes.data.id);
            messageInputRef.current?.focus();
          }
        } catch (e) {
          console.error('Failed to open chat with user param:', e);
        }
      }
    };

    findAndActivate();
  }, [targetUserParam, loadingChats, chats]);

  // Live user & friend search via query
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchedUsers([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        if (res.success && res.data?.users) {
          setSearchedUsers(res.data.users.filter((u: any) => u.id !== currentUser?.id));
        }
      } catch (err) {
        console.error('Search error in messages:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser?.id]);

  const loadConversations = async () => {
    setLoadingChats(true);
    try {
      const res = await api.get('/conversations');
      let currentChats: ChatItem[] = [];
      if (res.success && Array.isArray(res.data)) {
        currentChats = res.data;
      }

      let chosenActiveId = activeChatIdRef.current || activeChatId;

      if (targetUserParam) {
        const existing = currentChats.find(
          (c) =>
            !c.isGroup &&
            (c.otherUser?.id === targetUserParam ||
              c.participants?.some((p: any) => p.id === targetUserParam))
        );
        if (existing) {
          chosenActiveId = existing.id;
          setActiveChatId(existing.id);
        } else {
          const convRes = await api.post('/conversations', { recipientId: targetUserParam });
          if (convRes.success && convRes.data) {
            currentChats = [convRes.data, ...currentChats];
            chosenActiveId = convRes.data.id;
            setActiveChatId(convRes.data.id);
          }
        }
      } else if (currentChats.length > 0 && !chosenActiveId) {
        chosenActiveId = currentChats[0].id;
        setActiveChatId(currentChats[0].id);
      }

      if (chosenActiveId) {
        currentChats = currentChats.map((c) => (c.id === chosenActiveId ? { ...c, isUnread: false } : c));
        api.post(`/conversations/${chosenActiveId}/read`).catch(() => {});
      }

      setChats(currentChats);
      const unreadCount = currentChats.filter((c) => c.isUnread).length;
      setUnreadMessagesCount(unreadCount);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  // Switch conversation room & listen for messages
  useEffect(() => {
    if (!activeChatId) return;

    loadMessages(activeChatId);

    try {
      const socket = getSocket();
      socket.emit('chat:join', activeChatId);

      const handleNewMessage = (msg: any) => {
        if (msg.conversationId === activeChatId) {
          // Play sound if incoming from someone else
          if (msg.senderId && msg.senderId !== currentUser?.id) {
            playMessageChime();
          }

          // Strict deduplication
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          scrollToBottom();
        }
      };

      const handleUserTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
        if (userId !== currentUser?.id) {
          setIsOtherUserTyping(isTyping);
          if (isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsOtherUserTyping(false), 3000);
          }
        }
      };

      socket.on('chat:new_message', handleNewMessage);
      socket.on('chat:user_typing', handleUserTyping);
      return () => {
        socket.off('chat:new_message', handleNewMessage);
        socket.off('chat:user_typing', handleUserTyping);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setIsOtherUserTyping(false);
      };
    } catch (err) {
      console.error('Socket error in chat room:', err);
    }
  }, [activeChatId, currentUser?.id]);

  const loadMessages = async (convId: string) => {
    setLoadingMessages(true);
    // Mark as read immediately on backend and locally
    api.post(`/conversations/${convId}/read`).catch(() => {});
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === convId ? { ...c, isUnread: false } : c));
      const remainingUnread = updated.filter((c) => c.isUnread).length;
      setUnreadMessagesCount(remainingUnread);
      return updated;
    });

    try {
      const res = await api.get(`/conversations/${convId}/messages`);
      if (res.success && Array.isArray(res.data)) {
        setMessages(res.data);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeChat = chats.find((c) => c.id === activeChatId);

  // Send text message (with strict single-bubble deduplication)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId) return;

    const text = inputText.trim();
    setInputText('');

    try {
      const res = await api.post('/messages', {
        conversationId: activeChatId,
        content: text,
        isDisappearing: vanishMode,
        durationMinutes: vanishMode ? 5 : undefined,
      });

      if (res.success && res.data) {
        // Strict deduplication prevents duplicate bubbles
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.id)) return prev;
          return [...prev, res.data];
        });
        scrollToBottom();

        // Update last message preview in chat list and sort newest to top
        setChats((prev) =>
          prev
            .map((c) =>
              c.id === activeChatId
                ? { ...c, lastMessage: res.data, updatedAt: res.data.createdAt }
                : c
            )
            .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        );
      }
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  // Upload photo, video, document, or general file inside chat
  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, forcedType?: 'FILE') => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId) return;

    setIsUploadingChatFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.uploadWithProgress('/upload', formData, (percent) => {
        setUploadProgress(percent);
      });
      if (res.success && res.url) {
        let messageType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' = 'IMAGE';
        if (forcedType === 'FILE') {
          messageType = 'FILE';
        } else if (file.type.startsWith('video/')) {
          messageType = 'VIDEO';
        } else if (file.type.startsWith('audio/')) {
          messageType = 'AUDIO';
        } else if (
          file.type.startsWith('application/') ||
          file.type.startsWith('text/') ||
          file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|json)$/i)
        ) {
          messageType = 'FILE';
        }

        const sendRes = await api.post('/messages', {
          conversationId: activeChatId,
          content: messageType === 'FILE' ? file.name : '',
          mediaUrl: res.url,
          messageType,
          isDisappearing: vanishMode,
        });

        if (sendRes.success && sendRes.data) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === sendRes.data.id)) return prev;
            return [...prev, sendRes.data];
          });
          scrollToBottom();

          setChats((prev) =>
            prev
              .map((c) =>
                c.id === activeChatId
                  ? { ...c, lastMessage: sendRes.data, updatedAt: sendRes.data.createdAt }
                  : c
              )
              .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
          );
        }
      }
    } catch (err) {
      console.error('Chat file upload failed:', err);
    } finally {
      setIsUploadingChatFile(false);
      setUploadProgress(null);
      if (chatFileInputRef.current) {
        chatFileInputRef.current.value = '';
      }
      if (chatDocInputRef.current) {
        chatDocInputRef.current.value = '';
      }
    }
  };

  // ── Voice Message Recording Handlers ──────────────────────────────
  const startVoiceRecording = async () => {
    if (isRecordingVoice || !activeChatId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      audioChunksRef.current = [];
      setRecordingDuration(0);

      let options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      setIsRecordingVoice(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start voice recording:', err);
      alert('Microphone access is required to record voice messages.');
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingDuration(0);
  };

  const sendVoiceRecording = async () => {
    if (!mediaRecorderRef.current || !activeChatId) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    const duration = recordingDuration;

    recorder.onstop = async () => {
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
      }

      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      if (audioBlob.size === 0) {
        setIsRecordingVoice(false);
        setRecordingDuration(0);
        return;
      }

      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: mimeType });

      setIsUploadingChatFile(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await api.uploadWithProgress('/upload', formData, (percent) => {
          setUploadProgress(percent);
        });
        if (uploadRes.success && uploadRes.url) {
          const mins = Math.floor(duration / 60);
          const secs = duration % 60;
          const durStr = `${mins}:${secs.toString().padStart(2, '0')}`;

          const sendRes = await api.post('/messages', {
            conversationId: activeChatId,
            content: `Voice message (${durStr})`,
            mediaUrl: uploadRes.url,
            messageType: 'AUDIO',
            isDisappearing: vanishMode,
          });

          if (sendRes.success && sendRes.data) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === sendRes.data.id)) return prev;
              return [...prev, sendRes.data];
            });
            scrollToBottom();

            setChats((prev) =>
              prev
                .map((c) =>
                  c.id === activeChatId
                    ? { ...c, lastMessage: sendRes.data, updatedAt: sendRes.data.createdAt }
                    : c
                )
                .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
            );
          }
        }
      } catch (err) {
        console.error('Failed to send voice message:', err);
      } finally {
        setIsUploadingChatFile(false);
        setUploadProgress(null);
        setIsRecordingVoice(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
      }
    };

    if (recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch {}
      recorder.stop();
    }
  };

  // Select user from Search or Modal to start direct chat
  const handleSelectUserToChat = async (targetUser: any) => {
    if (!targetUser?.id) return;

    const existing = chats.find(
      (c) =>
        !c.isGroup &&
        (c.otherUser?.id === targetUser.id ||
          c.participants?.some((p: any) => p.id === targetUser.id))
    );

    if (existing) {
      setActiveChatId(existing.id);
    } else {
      try {
        const convRes = await api.post('/conversations', { recipientId: targetUser.id });
        if (convRes.success && convRes.data) {
          setChats((prev) => [convRes.data, ...prev.filter((c) => c.id !== convRes.data.id)]);
          setActiveChatId(convRes.data.id);
        }
      } catch (err) {
        console.error('Failed to create chat with selected user:', err);
      }
    }

    setSearchQuery('');
    setSearchedUsers([]);
    setTimeout(() => messageInputRef.current?.focus(), 150);
  };

  const handleCall = async (type: 'AUDIO' | 'VIDEO') => {
    if (!activeChat) return;

    const otherMember =
      activeChat.otherUser ||
      activeChat.participants?.find((p: any) => (p.userId || p.id) !== currentUser?.id);
    const targetUserId = otherMember?.userId || otherMember?.id || (activeChat as any).otherUserId;
    if (!targetUserId) {
      alert('Could not determine who to call in this chat.');
      return;
    }
    const targetUser = {
      id: targetUserId,
      username: otherMember?.username || activeChat.name,
      displayName: otherMember?.displayName || activeChat.name,
      avatarUrl: otherMember?.avatarUrl || activeChat.avatarUrl,
    };

    try {
      const res = await api.post('/calls', {
        receiverIds: [targetUser.id],
        type,
        conversationId: activeChat.id,
      });

      const callId = res.success && res.data ? res.data.id : `call_${Date.now()}`;

      setActiveCall({
        callId,
        otherUser: targetUser,
        type,
        isIncoming: false,
        status: 'CALLING',
      });
    } catch {
      setActiveCall({
        callId: `call_${Date.now()}`,
        otherUser: targetUser,
        type,
        isIncoming: false,
        status: 'CALLING',
      });
    }
  };

  const handleLudoChallenge = () => {
    if (!activeChat) return;
    const otherMember =
      activeChat.otherUser || activeChat.participants?.find((p: any) => p.id !== currentUser?.id);
    const targetUser = otherMember || {
      id: activeChat.id,
      displayName: activeChat.name,
    };
    if (!targetUser?.id) return;
    const socket = getSocket();
    const gameId = `ludo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    socket.emit('ludo:invite', { targetUserId: targetUser.id, gameId });
    alert(`Ludo game challenge sent to ${targetUser.displayName}! The board will open automatically when accepted. 🎲`);
  };

  const handleGroupCreated = (newGroup: any) => {
    setChats([newGroup, ...chats]);
    setActiveChatId(newGroup.id);
  };

  const regularChats = chats.filter((c) => !c.isMessageRequest);
  const requestChats = chats.filter((c) => c.isMessageRequest);

  const displayedChats = (activeTab === 'chats' ? regularChats : requestChats).filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Strict deduplication of displayed messages
  const uniqueMessages = Array.from(new Map(messages.map((m) => [m.id, m])).values());

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#070A12] flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-2xl shadow-rose-950/50">
          N
        </div>
        <p className="mt-4 text-xs font-semibold text-rose-300/80 tracking-widest uppercase animate-pulse">
          Loading Messages...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col selection:bg-rose-500/30 selection:text-rose-200">
      <Navbar />

      <div className="max-w-7xl mx-auto w-full px-4 flex gap-6 py-6 flex-1 h-[calc(100vh-5rem)]">
        <Sidebar />

        {/* Messenger Container */}
        <div className="flex-1 bg-[#111726]/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/[0.08] flex overflow-hidden">
          {/* Chat List (Left Pane) */}
          <div className="w-80 sm:w-96 border-r border-white/[0.08] flex flex-col bg-white/[0.01]">
            <div className="p-4 border-b border-white/[0.08]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-extrabold text-lg text-white">Messages</h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsStartChatModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/20 cursor-pointer"
                    title="Start direct chat with a friend"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>New Chat</span>
                  </button>

                  <button
                    onClick={() => setIsGroupModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08] rounded-xl text-xs font-medium transition-all cursor-pointer"
                    title="Create Group Chat"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Group</span>
                  </button>
                </div>
              </div>

              {/* Instant Search Bar */}
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages or friends by name..."
                  className="w-full bg-white/[0.04] text-xs pl-10 pr-4 py-2.5 rounded-xl border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/30 transition-all"
                />
              </div>
            </div>

            {/* Tabs for Chats vs Message Requests */}
            <div className="flex border-b border-white/[0.08] px-3 pt-2 bg-white/[0.02]">
              <button
                onClick={() => setActiveTab('chats')}
                className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'chats'
                    ? 'border-rose-500 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Chats</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-300">
                  {regularChats.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'requests'
                    ? 'border-rose-500 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Requests</span>
                {requestChats.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold animate-pulse">
                    {requestChats.length}
                  </span>
                )}
              </button>
            </div>

            {/* Conversation & Search Results */}
            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
              {/* Searched Users & Friends Result Section */}
              {searchQuery.trim().length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                    <span>Friends &amp; People</span>
                    {isSearchingUsers && <span className="text-[10px] text-slate-400 font-normal">Searching...</span>}
                  </div>

                  {searchedUsers.length > 0 ? (
                    <div className="flex flex-col gap-1 mt-1">
                      {searchedUsers.map((user) => {
                        const isOnline = onlineUsers.includes(user.id);
                        return (
                          <div
                            key={user.id}
                            onClick={() => handleSelectUserToChat(user)}
                            className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] hover:bg-rose-500/15 border border-white/[0.06] hover:border-rose-500/30 cursor-pointer transition-all group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative shrink-0">
                                <UserAvatar
                                  avatarUrl={user.avatarUrl}
                                  name={user.displayName}
                                  username={user.username}
                                  size="sm"
                                />
                                {isOnline && (
                                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                                  {user.displayName}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">@{user.username}</p>
                              </div>
                            </div>
                            <span className="text-[11px] text-rose-400 group-hover:text-rose-300 font-bold flex items-center gap-1">
                              <span>Chat</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : !isSearchingUsers ? (
                    <p className="px-2 py-1.5 text-[11px] text-slate-500">No users found for &ldquo;{searchQuery}&rdquo;</p>
                  ) : null}

                  {displayedChats.length > 0 && (
                    <div className="px-2 pt-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Conversations</span>
                    </div>
                  )}
                </div>
              )}

              {loadingChats && (
                <div className="p-4 text-center text-xs text-slate-400">Loading conversations...</div>
              )}

              {!loadingChats && displayedChats.length === 0 && !searchQuery.trim() && (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <span>
                    {activeTab === 'requests'
                      ? 'No message requests at this time.'
                      : 'No messages yet. Start a chat with a friend!'}
                  </span>
                  {activeTab === 'chats' && (
                    <button
                      onClick={() => setIsStartChatModalOpen(true)}
                      className="mt-1 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>Start Chat</span>
                    </button>
                  )}
                </div>
              )}

              {displayedChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all cursor-pointer ${
                    activeChatId === chat.id
                      ? 'bg-gradient-to-r from-rose-500/15 to-indigo-600/15 border border-rose-500/30 text-white'
                      : 'hover:bg-white/[0.04] text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="relative shrink-0">
                    <UserAvatar
                      avatarUrl={chat.avatarUrl}
                      name={chat.name}
                      size="lg"
                    />
                    {chat.isGroup ? (
                      <span className="absolute bottom-0 right-0 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] ring-2 ring-[#0B0F19]">
                        <Users className="w-2.5 h-2.5" />
                      </span>
                    ) : chat.otherUser && onlineUsers.includes(chat.otherUser.id) ? (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#0B0F19]" />
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-semibold text-white text-sm truncate">
                        {chat.name}
                      </p>
                      {chat.updatedAt && (
                        <span className="text-[11px] text-slate-400">{formatDate(chat.updatedAt)}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                      {chat.lastMessage?.messageType === 'IMAGE' ? (
                        <span className="text-rose-400 flex items-center gap-1">📷 Photo</span>
                      ) : chat.lastMessage?.messageType === 'VIDEO' ? (
                        <span className="text-indigo-400 flex items-center gap-1">🎥 Video</span>
                      ) : chat.lastMessage?.messageType === 'AUDIO' ? (
                        <span className="text-emerald-400 flex items-center gap-1">🎙️ Voice message</span>
                      ) : chat.lastMessage?.messageType === 'FILE' ? (
                        <span className="text-amber-400 flex items-center gap-1">📁 {chat.lastMessage.content || 'Document'}</span>
                      ) : (
                        <span>{chat.lastMessage?.content || 'Start a conversation...'}</span>
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Window (Right Pane) */}
          {activeChat ? (
            <div className="flex-1 flex flex-col bg-white/[0.01]">
              {/* Header */}
              <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-[#111726]/60 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <UserAvatar
                      avatarUrl={activeChat.avatarUrl}
                      name={activeChat.name}
                      size="md"
                    />
                    {!activeChat.isGroup && activeChat.otherUser && onlineUsers.includes(activeChat.otherUser.id) && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#111726]" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{activeChat.name}</h3>
                    {activeChat.isGroup ? (
                      <p className="text-xs text-slate-400">
                        Group Chat ({activeChat.participants?.length || 2} members)
                      </p>
                    ) : activeChat.otherUser && onlineUsers.includes(activeChat.otherUser.id) ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-semibold text-emerald-400">Active now</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatLastActive(
                          activeChat.otherUser
                            ? userLastSeen[activeChat.otherUser.id] || activeChat.otherUser.lastSeenAt
                            : null
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setVanishMode(!vanishMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      vanishMode
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse'
                        : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08]'
                    }`}
                    title="Vanish Mode: Messages disappear after being viewed"
                  >
                    <Flame className={`w-4 h-4 ${vanishMode ? 'fill-white' : 'text-rose-400'}`} />
                    <span className="hidden md:inline">Vanish Mode</span>
                  </button>

                  <button
                    onClick={() => handleCall('AUDIO')}
                    className="p-2.5 rounded-xl transition-all text-slate-300 hover:text-white hover:bg-white/[0.08] cursor-pointer"
                    title={activeChat.isGroup ? 'Group Audio Call' : 'Audio Call'}
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleCall('VIDEO')}
                    className="p-2.5 rounded-xl transition-all text-slate-300 hover:text-white hover:bg-white/[0.08] cursor-pointer"
                    title={activeChat.isGroup ? 'Group Video Call' : 'Video Call'}
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  {/* Ludo Challenge */}
                  <button
                    onClick={handleLudoChallenge}
                    className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl transition-all border border-amber-500/20 cursor-pointer"
                    title="Play Ludo Game Challenge"
                  >
                    <Gamepad2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {vanishMode && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center text-xs text-rose-300 flex items-center justify-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <span>Vanish Mode is on — messages disappear when the chat is closed.</span>
                  </div>
                )}

                {loadingMessages && (
                  <div className="text-center text-xs text-slate-400 py-6">Loading messages...</div>
                )}

                {!loadingMessages && uniqueMessages.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-slate-400 p-8 gap-2">
                    <MessageCircle className="w-8 h-8 text-slate-500" />
                    <span>No messages here yet. Send a message to start chatting! 👋</span>
                  </div>
                )}

                {uniqueMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser?.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      {!isMe && activeChat.isGroup && msg.sender?.displayName && (
                        <span className="text-[10px] text-slate-400 ml-2 mb-1">
                          {msg.sender.displayName}
                        </span>
                      )}

                      <div className={`flex items-center gap-1.5 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Sender Delete Button (appears on hover) */}
                        {isMe && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            disabled={deletingMessageId === msg.id}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer shrink-0 disabled:opacity-40"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div
                          className={`rounded-2xl p-3 text-sm shadow-md transition-all ${
                            isMe
                              ? 'bg-gradient-to-tr from-rose-500 to-indigo-600 text-white rounded-br-sm'
                              : 'bg-[#182032] text-slate-100 border border-white/[0.06] rounded-bl-sm'
                          }`}
                        >
                          {/* Audio / Voice message */}
                          {msg.mediaUrl && (msg.messageType === 'AUDIO' || msg.mediaUrl.match(/\.(webm|mp3|wav|ogg|m4a|aac)$/i)) ? (
                            <VoiceMessageBubble mediaUrl={resolveMediaUrl(msg.mediaUrl)} isMe={isMe} durationText={msg.content} />
                          ) : msg.mediaUrl && (msg.messageType === 'FILE' || msg.mediaUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|json)$/i)) ? (
                            /* Document / File Attachment */
                            <DocumentMessageBubble mediaUrl={resolveMediaUrl(msg.mediaUrl)} fileName={msg.content} isMe={isMe} />
                          ) : (
                            <>
                              {msg.content &&
                                !msg.content.match(/\.(jpe?g|png|webp|gif|svg|bmp|mp4|webm|mov|mkv)$/i) &&
                                !msg.content.startsWith('WhatsApp Image') &&
                                !msg.content.startsWith('image_') &&
                                !msg.content.startsWith('video_') && (
                                  <p className="leading-relaxed whitespace-pre-wrap mb-1.5">{msg.content}</p>
                                )}

                              {msg.mediaUrl && (
                                <div className="rounded-xl overflow-hidden border border-white/10 relative group/media">
                                  {msg.messageType === 'VIDEO' || msg.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                                    <video
                                      src={resolveMediaUrl(msg.mediaUrl)}
                                      controls
                                      playsInline
                                      className="max-w-full rounded-xl max-h-72 object-cover bg-black"
                                    />
                                  ) : (
                                    <img
                                      src={resolveMediaUrl(msg.mediaUrl)}
                                      alt="Shared media"
                                      className="max-w-full rounded-xl max-h-72 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                      onClick={() => setPreviewPhotoUrl(resolveMediaUrl(msg.mediaUrl!))}
                                    />
                                  )}

                                  {/* Quick Download Overlay Button for Photo/Video */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const fname = msg.mediaUrl!.split('/').pop() || (msg.messageType === 'VIDEO' ? 'video.mp4' : 'photo.jpg');
                                      triggerDownload(resolveMediaUrl(msg.mediaUrl!), fname);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/85 text-white/80 hover:text-white transition-all shadow-md backdrop-blur-sm cursor-pointer opacity-80 hover:opacity-100"
                                    title="Download media"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${isMe ? 'text-white/70 justify-end' : 'text-slate-400'}`}>
                            <span>{formatDate(msg.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isOtherUserTyping && (
                  <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 bg-white/[0.04] rounded-2xl w-fit border border-white/[0.08] animate-in fade-in">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">{activeChat.name} is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Upload Progress Bar for Large Files */}
              {uploadProgress !== null && (
                <div className="px-4 py-2 bg-indigo-950/70 border-t border-indigo-500/30 flex items-center gap-3 animate-in fade-in">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-indigo-200 font-medium mb-1">
                      <span>Uploading file...</span>
                      <span className="font-mono font-bold text-white">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-indigo-500 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Message Input Footer */}
              {isRecordingVoice ? (
                /* Live Voice Message Recording UI */
                <div className="p-3 bg-[#111726]/80 backdrop-blur-md border-t border-rose-500/30 flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Recording Voice Note</span>
                      <span className="text-xs font-mono font-bold text-white bg-rose-500/20 px-2 py-0.5 rounded-md border border-rose-500/30">
                        {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="button"
                      onClick={sendVoiceRecording}
                      disabled={isUploadingChatFile}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white shadow-md shadow-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingChatFile ? (
                        <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Send Voice</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="p-3 bg-[#111726]/60 backdrop-blur-md border-t border-white/[0.08] flex items-center gap-2">
                  {/* Photo/Video Picker */}
                  <input
                    type="file"
                    ref={chatFileInputRef}
                    onChange={(e) => handleChatFileUpload(e)}
                    accept="image/*,video/*"
                    className="hidden"
                  />

                  {/* Documents & Files Picker */}
                  <input
                    type="file"
                    ref={chatDocInputRef}
                    onChange={(e) => handleChatFileUpload(e, 'FILE')}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,application/*,text/*"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => chatFileInputRef.current?.click()}
                    disabled={isUploadingChatFile}
                    className="p-2.5 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    title="Send photo or video"
                  >
                    {isUploadingChatFile ? (
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-rose-500 border-t-transparent" />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => chatDocInputRef.current?.click()}
                    disabled={isUploadingChatFile}
                    className="p-2.5 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    title="Send document or file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <input
                    ref={messageInputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      if (activeChatId) {
                        try {
                          const socket = getSocket();
                          socket.emit('chat:typing', { conversationId: activeChatId, isTyping: true });
                        } catch {}
                      }
                    }}
                    placeholder={
                      vanishMode
                        ? 'Write a vanish message...'
                        : activeChat.isGroup
                        ? 'Message the group...'
                        : `Message ${activeChat.name}...`
                    }
                    className="flex-1 bg-white/[0.05] focus:bg-white/[0.08] text-sm px-4 py-2.5 rounded-xl border border-white/[0.08] text-white placeholder-slate-500 focus:border-rose-500/50 outline-none transition-all"
                  />

                  {/* Mic / Voice Note Button */}
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                    title="Record voice message"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="p-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-rose-500/20 cursor-pointer"
                    title="Send message"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Welcome / Empty Selection State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4 bg-white/[0.01]">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-rose-500/20 via-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/30">
                <MessageCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Your Direct Messages</h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  Chat privately with friends, share photos and videos, challenge each other to Ludo, or make audio &amp; video calls.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setIsStartChatModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 via-rose-600 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-500/25 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>Start a Chat with a Friend</span>
                </button>

                <button
                  onClick={() => setIsGroupModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold rounded-xl border border-white/[0.08] transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4 text-slate-300" />
                  <span>Create Group</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Start Direct Chat with a Friend Modal */}
      <StartChatModal
        isOpen={isStartChatModalOpen}
        onClose={() => setIsStartChatModalOpen(false)}
        onSelectUser={handleSelectUserToChat}
      />

      {/* Group Create Modal */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onGroupCreated={handleGroupCreated}
      />

      {/* Lightbox Full Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in"
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerDownload(previewPhotoUrl, 'photo.jpg');
              }}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all shadow-lg cursor-pointer"
              title="Download image"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all shadow-lg cursor-pointer"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center"
          >
            <img
              src={previewPhotoUrl}
              alt="Photo preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070A12] flex flex-col items-center justify-center p-6 text-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-2xl shadow-rose-950/50">
            N
          </div>
          <p className="mt-4 text-xs font-semibold text-rose-300/80 tracking-widest uppercase animate-pulse">
            Loading Messages...
          </p>
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
