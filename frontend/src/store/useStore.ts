import { create } from 'zustand';
import { api } from '../lib/api';
import { SoundSettings, getStoredSoundSettings, saveStoredSoundSettings } from '../lib/soundUtils';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email?: string;
  isVerified?: boolean;
  isPrivate?: boolean;
}

export interface ActiveCall {
  callId: string;
  otherUser: User;
  type: 'AUDIO' | 'VIDEO';
  isIncoming: boolean;
  status: 'CALLING' | 'RINGING' | 'CONNECTING' | 'CONNECTED' | 'ENDED';
  offer?: any;
  pendingIceCandidates?: any[];
}


export interface LudoInvite {
  gameId: string;
  fromUser: User;
}

interface AppState {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isLoadingUser: boolean;
  fetchCurrentUser: () => Promise<User | null>;
  onlineUsers: string[];
  setOnlineUsers: (users: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string, lastSeenAt?: string) => void;
  userLastSeen: Record<string, string>;
  setUserLastSeen: (userId: string, lastSeenAt: string) => void;
  setMultipleUserLastSeen: (map: Record<string, string>) => void;
  activeCall: ActiveCall | null;
  setActiveCall: (call: ActiveCall | null) => void;
  unreadMessagesCount: number;
  setUnreadMessagesCount: (count: number) => void;
  unreadNotificationsCount: number;
  setUnreadNotificationsCount: (count: number) => void;
  incomingLudoInvite: LudoInvite | null;
  setIncomingLudoInvite: (invite: LudoInvite | null) => void;
  activeLudoGameId: string | null;
  setActiveLudoGameId: (gameId: string | null) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  toggleMute: () => void;
  soundSettings: SoundSettings;
  setSoundSettings: (settings: Partial<SoundSettings> | ((prev: SoundSettings) => SoundSettings)) => void;
}

const getStoredMuted = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem('nuraiyan_muted');
    return val !== null ? val === 'true' : true; // Default muted for pleasant scrolling
  } catch {
    return true;
  }
};

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('nuraiyan_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useStore = create<AppState>((set) => ({
  currentUser: getStoredUser(),
  setCurrentUser: (user) => {

    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('nuraiyan_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('nuraiyan_user');
        localStorage.removeItem('nuraiyan_token');
      }
    }
    set({ currentUser: user });
  },
  isLoadingUser: false,
  fetchCurrentUser: async () => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('nuraiyan_token');
    const stored = getStoredUser();

    if (!token && !stored) {
      set({ currentUser: null, isLoadingUser: false });
      return null;
    }

    try {
      set({ isLoadingUser: true });
      const res = await api.get('/auth/me');
      if (res.success && res.data) {
        localStorage.setItem('nuraiyan_user', JSON.stringify(res.data));
        set({ currentUser: res.data, isLoadingUser: false });
        return res.data;
      } else if (res.status === 401) {
        // Explicit auth rejection — clear session
        localStorage.removeItem('nuraiyan_user');
        localStorage.removeItem('nuraiyan_token');
        set({ currentUser: null, isLoadingUser: false });
        return null;
      } else {
        // Server error — keep stored session, do NOT logout
        if (stored) {
          set({ currentUser: stored, isLoadingUser: false });
          return stored;
        }
        set({ isLoadingUser: false });
        return null;
      }
    } catch {
      // Network failure — preserve stored session, do NOT logout
      if (stored) {
        set({ currentUser: stored, isLoadingUser: false });
        return stored;
      }
      set({ isLoadingUser: false });
      return null;
    }
  },

  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  addOnlineUser: (userId) =>
    set((state) => ({ onlineUsers: Array.from(new Set([...state.onlineUsers, userId])) })),
  removeOnlineUser: (userId, lastSeenAt) =>
    set((state) => {
      const nextLastSeen = { ...state.userLastSeen };
      if (lastSeenAt) {
        nextLastSeen[userId] = lastSeenAt;
      } else {
        nextLastSeen[userId] = new Date().toISOString();
      }
      return {
        onlineUsers: state.onlineUsers.filter((id) => id !== userId),
        userLastSeen: nextLastSeen,
      };
    }),
  userLastSeen: {},
  setUserLastSeen: (userId, lastSeenAt) =>
    set((state) => ({
      userLastSeen: {
        ...state.userLastSeen,
        [userId]: lastSeenAt,
      },
    })),
  setMultipleUserLastSeen: (map) =>
    set((state) => ({
      userLastSeen: {
        ...state.userLastSeen,
        ...map,
      },
    })),
  activeCall: null,
  setActiveCall: (activeCall) => set({ activeCall }),
  unreadMessagesCount: 0,
  setUnreadMessagesCount: (count) => set({ unreadMessagesCount: count }),
  unreadNotificationsCount: 0,
  setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),
  incomingLudoInvite: null,
  setIncomingLudoInvite: (incomingLudoInvite) => set({ incomingLudoInvite }),
  activeLudoGameId: null,
  setActiveLudoGameId: (activeLudoGameId) => set({ activeLudoGameId }),
  isMuted: getStoredMuted(),
  setIsMuted: (isMuted) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nuraiyan_muted', isMuted ? 'true' : 'false');
    }
    set({ isMuted });
  },
  toggleMute: () => {
    const next = !useStore.getState().isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nuraiyan_muted', next ? 'true' : 'false');
    }
    set({ isMuted: next });
  },
  soundSettings: getStoredSoundSettings(),
  setSoundSettings: (updater) => {
    set((state) => {
      const updated = typeof updater === 'function' ? updater(state.soundSettings) : { ...state.soundSettings, ...updater };
      saveStoredSoundSettings(updated);
      return { soundSettings: updated };
    });
  },
}));
