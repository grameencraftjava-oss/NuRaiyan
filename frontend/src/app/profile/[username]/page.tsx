'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '../../../components/Navbar';
import { Sidebar } from '../../../components/Sidebar';
import {
  Grid,
  MessageCircle,
  Camera,
  CheckCircle2,
  Calendar,
  UserX,
  Edit3,
  KeyRound,
  X,
  Check,
  Lock,
  Eye,
  EyeOff,
  Upload,
  Loader2,
  Sparkles,
  Briefcase,
  GraduationCap,
  School,
  MapPin,
  Home,
  Heart,
  Globe,
  Plus,
  Radio,
  Bookmark,
  Play,
  Trash2,
  Video,
  UserPlus,
  UserCheck,
  Users,
  Phone,
  ChevronDown,
  ExternalLink,
  Download,
  Send,
} from 'lucide-react';

import { useStore } from '../../../store/useStore';
import { api, resolveMediaUrl } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { formatDate, formatLastActive, isVideoUrl } from '../../../lib/utils';
import { PostCard } from '../../../components/PostCard';
import { UserAvatar } from '../../../components/UserAvatar';
import ReplayVideoPlayer from '../../../components/live/ReplayVideoPlayer';

const SUGGESTIONS = {
  companies: [
    'Google', 'Microsoft', 'Meta', 'Apple', 'Amazon', 'Netflix', 'Grameenphone', 'BRAC', 'bKash', 'Pathao', 'Chaldal', 'Brain Station 23', 'Samsung Electronics', 'Software Engineer', 'Senior Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'UI/UX Designer', 'Product Manager', 'Founder & CEO', 'Self-Employed', 'Freelancer', 'Student'
  ],
  universities: [
    'University of Dhaka', 'Bangladesh University of Engineering and Technology (BUET)', 'North South University (NSU)', 'BRAC University', 'Jahangirnagar University', 'Rajshahi University', 'Chittagong University', 'Independent University, Bangladesh (IUB)', 'United International University (UIU)', 'Harvard University', 'Massachusetts Institute of Technology (MIT)', 'Stanford University', 'University of Oxford', 'University of Cambridge', 'University of Toronto', 'NYU'
  ],
  colleges: [
    'Notre Dame College, Dhaka', 'Dhaka College', 'Rajuk Uttara Model College', 'Viqarunnisa Noon College', 'Holy Cross College, Dhaka', 'Adamjee Cantonment College', 'Residential Model College', 'City College, Dhaka', 'Chittagong College'
  ],
  schools: [
    'St. Joseph Higher Secondary School', 'Ideal School and College', 'Motijheel Government Boys High School', 'Willes Little Flower School', 'Milestone College / School', 'Maple Leaf International School', 'Mastermind School', 'South Breeze School'
  ],
  cities: [
    'Dhaka, Bangladesh', 'Chittagong, Bangladesh', 'Sylhet, Bangladesh', 'Rajshahi, Bangladesh', 'Khulna, Bangladesh', 'Barisal, Bangladesh', 'Rangpur, Bangladesh', 'Mymensingh, Bangladesh', 'Comilla, Bangladesh', 'Cox\'s Bazar, Bangladesh', 'New York, USA', 'London, UK', 'Toronto, Canada', 'Dubai, UAE', 'Sydney, Australia', 'Singapore', 'Kuala Lumpur, Malaysia'
  ]
};

interface AutocompleteInputProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  suggestions: string[];
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  label,
  icon,
  value,
  onChange,
  placeholder,
  suggestions,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions
    .filter((s) => s.toLowerCase().includes((value || '').toLowerCase()))
    .slice(0, 6);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-semibold text-slate-300 mb-1.5">{label}</label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
          {icon}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-rose-500/50 focus:outline-none transition-all"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#182032] border border-white/[0.12] rounded-xl shadow-2xl py-1 z-50 max-h-48 overflow-y-auto scrollbar-thin animate-in fade-in">
          {filtered.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-white/[0.08] hover:text-white flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>{item}</span>
              <span className="text-[10px] text-rose-400">Select</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


export default function ProfilePage({ params }: { params: { username: string } }) {
  const { currentUser, setCurrentUser, setActiveCall, onlineUsers, userLastSeen, isMuted } = useStore();
  const [activeTab, setActiveTab] = useState<'POSTS' | 'LIVE' | 'PHOTOS' | 'SAVED'>('POSTS');

  // Real-time ticker to update relative active timestamps live
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const [profileUser, setProfileUser] = useState<any>(null);
  const [selectedReplay, setSelectedReplay] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Facebook-Style Friend System States
  const [friendshipStatus, setFriendshipStatus] = useState<
    'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' | 'SELF'
  >('NONE');
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [replayCommentInput, setReplayCommentInput] = useState('');
  const [isPostingReplayComment, setIsPostingReplayComment] = useState(false);

  // Automatically fetch fresh stream details and recorded comments when replay opens
  useEffect(() => {
    if (selectedReplay?.id) {
      api.get(`/live/${selectedReplay.id}`).then((res) => {
        if (res.success && res.data) {
          setSelectedReplay((prev: any) => ({
            ...prev,
            ...res.data,
            comments: res.data.comments || [],
          }));
        }
      }).catch((err) => console.error('Failed to load replay stream details:', err));
    }
  }, [selectedReplay?.id]);

  const handleSendReplayComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replayCommentInput.trim() || !selectedReplay?.id || isPostingReplayComment) return;

    const text = replayCommentInput.trim();
    const commentId = `lc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticComment = {
      id: commentId,
      streamId: selectedReplay.id,
      text,
      createdAt: new Date().toISOString(),
      user: {
        id: currentUser?.id,
        username: currentUser?.username,
        displayName: currentUser?.displayName || 'User',
        avatarUrl: currentUser?.avatarUrl,
      },
    };

    setSelectedReplay((prev: any) => ({
      ...prev,
      comments: [...(prev?.comments || []), optimisticComment],
    }));
    setReplayCommentInput('');
    setIsPostingReplayComment(true);

    try {
      await api.post(`/live/${selectedReplay.id}/comment`, { text, id: commentId });
    } catch (err) {
      console.error('Failed to post replay comment:', err);
    } finally {
      setIsPostingReplayComment(false);
    }
  };


  // File Upload Refs & States
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Edit Profile Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    displayName: '',
    bio: '',
    isPrivate: false,
    worksAt: '',
    education: '',
    college: '',
    school: '',
    location: '',
    hometown: '',
    relationship: '',
    website: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');
  const [editError, setEditError] = useState('');

  // Change Password Modal
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadProfile();
  }, [params.username]);

  const loadFriendsList = async (userId: string) => {
    try {
      const res = await api.get(`/friends/list/${userId}`);
      if (res.success && res.data) {
        setFriendsList(res.data.slice(0, 9));
      }
    } catch (err) {
      console.error('Failed to load friends list:', err);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/${params.username}`);
      if (res.success && res.data) {
        setProfileUser(res.data);
        setFriendshipStatus(res.data.friendshipStatus || 'NONE');
        setFriendsCount(res.data.friendsCount || 0);
        loadFriendsList(res.data.id);

        // Targeted friendship status check
        api.get(`/friends/status/${res.data.id}`).then((st) => {
          if (st.success && st.data?.status) {
            setFriendshipStatus(st.data.status);
          }
        }).catch(() => {});

        setEditFormData({
          displayName: res.data.displayName || '',
          bio: res.data.bio || '',
          isPrivate: res.data.isPrivate || false,
          worksAt: res.data.worksAt || '',
          education: res.data.education || '',
          college: res.data.college || '',
          school: res.data.school || '',
          location: res.data.location || '',
          hometown: res.data.hometown || '',
          relationship: res.data.relationship || '',
          website: res.data.website || '',
        });
      } else {
        setProfileUser(null);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Friend Request & Friendship Handlers ───────────────────
  const handleSendFriendRequest = async () => {
    if (!profileUser) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/friends/request/${profileUser.id}`);
      if (res.success) {
        setFriendshipStatus(res.status || 'PENDING_SENT');
        if (res.status === 'FRIENDS') {
          setFriendsCount((prev) => prev + 1);
          loadFriendsList(profileUser.id);
        }
      } else {
        alert(res.message || 'Could not send friend request.');
        if (res.message?.includes('already friends')) {
          setFriendshipStatus('FRIENDS');
        }
      }
    } catch (err) {
      console.error('Send friend request error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!profileUser) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/friends/accept/${profileUser.id}`);
      if (res.success) {
        setFriendshipStatus('FRIENDS');
        setFriendsCount((prev) => prev + 1);
        loadFriendsList(profileUser.id);
      } else {
        alert(res.message || 'Could not accept friend request.');
      }
    } catch (err) {
      console.error('Accept friend request error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrRejectRequest = async () => {
    if (!profileUser) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/friends/reject/${profileUser.id}`);
      if (res.success) {
        setFriendshipStatus('NONE');
      } else {
        alert(res.message || 'Could not cancel friend request.');
      }
    } catch (err) {
      console.error('Cancel friend request error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!profileUser) return;
    if (!confirm(`Are you sure you want to remove ${profileUser.displayName} from your friends?`)) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/friends/unfriend/${profileUser.id}`);
      if (res.success) {
        setFriendshipStatus('NONE');
        setFriendsCount((prev) => Math.max(0, prev - 1));
        setShowFriendMenu(false);
        loadFriendsList(profileUser.id);
      } else {
        alert(res.message || 'Failed to unfriend.');
      }
    } catch (err) {
      console.error('Unfriend error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartCall = (type: 'AUDIO' | 'VIDEO') => {
    if (!profileUser) return;
    setActiveCall({
      callId: `call_${Date.now()}`,
      otherUser: {
        id: profileUser.id,
        username: profileUser.username,
        displayName: profileUser.displayName,
        avatarUrl: profileUser.avatarUrl || null,
      },
      type,
      isIncoming: false,
      status: 'CALLING',
    });
  };

  const handleLudoInvite = () => {
    if (!profileUser) return;
    const socket = getSocket();
    const gameId = `ludo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    socket.emit('ludo:invite', { targetUserId: profileUser.id, gameId });
    alert(`Ludo game challenge sent to ${profileUser.displayName}! The game will begin when accepted. 🎲`);
  };

  const loadSavedPosts = async () => {
    setLoadingSaved(true);
    try {
      const res = await api.get('/posts/saved');
      if (res.success && Array.isArray(res.data)) {
        setSavedPosts(res.data);
      }
    } catch (err) {
      console.error('Failed to load saved posts:', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleDeleteLiveStream = async (streamId: string) => {
    if (!confirm('Are you sure you want to permanently delete this live stream replay?')) return;
    try {
      const res = await api.delete(`/live/${streamId}`);
      if (res.success) {
        setProfileUser((prev: any) => ({
          ...prev,
          liveStreams: (prev?.liveStreams || []).filter((s: any) => s.id !== streamId),
        }));
      } else {
        alert(res.message || 'Failed to delete live stream.');
      }
    } catch {
      alert('Network error: Could not delete live stream.');
    }
  };

  // ── Real-Time Avatar Photo Upload & Permanent DB Save ─────────

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'AVATAR');

      const uploadRes = await api.upload('/upload', formData);
      const newAvatarUrl = uploadRes.url || uploadRes.data?.url;
      if (uploadRes.success && newAvatarUrl) {
        // Persist to database
        const updateRes = await api.patch('/users/profile', { avatarUrl: newAvatarUrl });
        if (updateRes.success) {
          setProfileUser((prev: any) => ({ ...prev, avatarUrl: newAvatarUrl }));
          if (currentUser) {
            setCurrentUser({ ...currentUser, avatarUrl: newAvatarUrl });
          }
        }
      } else {
        alert(uploadRes.message || 'Profile photo upload failed.');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      alert('Failed to upload image to server.');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // ── Real-Time Cover Photo Upload & Permanent DB Save ──────────
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'COVER');

      const uploadRes = await api.upload('/upload', formData);
      const newCoverUrl = uploadRes.url || uploadRes.data?.url;
      if (uploadRes.success && newCoverUrl) {
        // Persist to database
        const updateRes = await api.patch('/users/profile', { coverUrl: newCoverUrl });
        if (updateRes.success) {
          setProfileUser((prev: any) => ({ ...prev, coverUrl: newCoverUrl }));
        }
      } else {
        alert(uploadRes.message || 'Cover photo upload failed.');
      }
    } catch (err) {
      console.error('Cover upload failed:', err);
      alert('Failed to upload cover photo to server.');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }

  };

  // ── Profile Edit Save ─────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');

    try {
      const res = await api.patch('/users/profile', {
        displayName: editFormData.displayName.trim(),
        bio: editFormData.bio.trim(),
        isPrivate: editFormData.isPrivate,
        worksAt: editFormData.worksAt.trim() || null,
        education: editFormData.education.trim() || null,
        college: editFormData.college.trim() || null,
        school: editFormData.school.trim() || null,
        location: editFormData.location.trim() || null,
        hometown: editFormData.hometown.trim() || null,
        relationship: editFormData.relationship.trim() || null,
        website: editFormData.website.trim() || null,
      });

      if (res.success && res.data) {
        setEditSuccess('Profile updated successfully!');
        setProfileUser((prev: any) => ({
          ...prev,
          ...res.data,
        }));
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            displayName: res.data.displayName,
          });
        }
        setTimeout(() => {
          setIsEditProfileOpen(false);
          setEditSuccess('');
        }, 800);
      } else {
        setEditError(res.message || 'Profile update failed.');
      }
    } catch (err: any) {
      setEditError('Unable to connect to the server.');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Change Password Save ──────────────────────────────────────
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      setPasswordError('New passwords do not match!');
      setPasswordLoading(false);
      return;
    }

    if (passwordFormData.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      setPasswordLoading(false);
      return;
    }

    try {
      const res = await api.post('/auth/change-password', {
        currentPassword: passwordFormData.currentPassword,
        newPassword: passwordFormData.newPassword,
      });

      if (res.success) {
        setPasswordSuccess('Password changed successfully! 🔒');
        if (res.accessToken) {
          localStorage.setItem('nuraiyan_token', res.accessToken);
        }
        setPasswordFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setIsChangePasswordOpen(false);
          setPasswordSuccess('');
        }, 1200);
      } else {
        setPasswordError(res.message || 'Password update failed.');
      }
    } catch (err: any) {
      setPasswordError('Server connection failed.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const isMe =
    currentUser?.id === profileUser?.id ||
    currentUser?.username?.toLowerCase() === profileUser?.username?.toLowerCase();

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#070A12] flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-2xl shadow-rose-950/50">
          N
        </div>
        <p className="mt-4 text-xs font-semibold text-rose-300/80 tracking-widest uppercase animate-pulse">
          Loading Profile...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col selection:bg-rose-500/30 selection:text-rose-200">
      <Navbar />

      {/* Hidden File Inputs for Avatar & Cover */}
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarChange}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={coverInputRef}
        onChange={handleCoverChange}
        accept="image/*"
        className="hidden"
      />

      <div className="max-w-7xl mx-auto w-full px-2.5 sm:px-4 flex gap-6 py-4 sm:py-6 pb-24 lg:pb-8 flex-1">
        <Sidebar />

        <main className="flex-1 max-w-4xl mx-auto w-full">
          {loading && (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/60 animate-pulse space-y-4">
              <div className="h-48 bg-slate-200 rounded-2xl" />
              <div className="w-28 h-28 rounded-full bg-slate-300 -mt-16 mx-6 border-4 border-white" />
              <div className="h-6 w-48 bg-slate-200 rounded mx-6" />
              <div className="h-4 w-64 bg-slate-100 rounded mx-6" />
            </div>
          )}

          {!loading && !profileUser && (
            <div className="bg-white rounded-3xl p-12 border border-slate-200/60 text-center">
              <UserX className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-800">User not found</h2>
              <p className="text-xs text-slate-500 mt-1">There is no active profile for @{params.username}.</p>
            </div>
          )}

          {!loading && profileUser && (
            <>
              {/* Profile Header Card */}
              <div className="bg-[#111726]/80 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xl border border-white/[0.08] mb-6">
                {/* Cover Banner */}
                <div className="relative h-48 sm:h-64 bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 group">
                  {profileUser.coverUrl ? (
                    <img
                      src={resolveMediaUrl(profileUser.coverUrl)}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-medium">
                      <span>Click the button on the right to add a cover photo</span>
                    </div>
                  )}

                  {isMe && (
                    <button
                      type="button"
                      disabled={uploadingCover}
                      onClick={() => coverInputRef.current?.click()}
                      className="absolute bottom-4 right-4 bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-white/20"
                    >
                      {uploadingCover ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5 text-rose-300" />
                          <span>Change Cover</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Profile Info Section */}
                <div className="px-6 pb-6 pt-0 relative">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
                    {/* Avatar with Camera Button */}
                    <div className="relative inline-block group">
                      <UserAvatar
                        avatarUrl={profileUser.avatarUrl}
                        name={profileUser.displayName}
                        username={profileUser.username}
                        size="2xl"
                        className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-[#070A12] shadow-2xl ring-2 ring-white/10 text-4xl sm:text-5xl"
                      />

                      {isMe && (
                        <button
                          type="button"
                          disabled={uploadingAvatar}
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute bottom-1 right-1 p-2.5 bg-rose-500 hover:bg-rose-600 rounded-full text-white cursor-pointer transition-transform group-hover:scale-105 shadow-lg border-2 border-[#111726]"
                          title="Change profile picture"
                        >
                          {uploadingAvatar ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <Camera className="w-4 h-4 text-white" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Action Buttons: Edit Profile or Facebook-Style Friend Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isMe ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsEditProfileOpen(true)}
                            className="px-4 py-2 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Profile</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsChangePasswordOpen(true)}
                            className="px-3.5 py-2 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                            <span>Change Password</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Facebook-Style Friend Request State Button */}
                          {friendshipStatus === 'NONE' && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={handleSendFriendRequest}
                              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <UserPlus className="w-4 h-4" />
                              <span>Add Friend</span>
                            </button>
                          )}

                          {friendshipStatus === 'PENDING_SENT' && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={handleCancelOrRejectRequest}
                              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 border border-white/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                              title="Click to cancel friend request"
                            >
                              <UserX className="w-4 h-4 text-slate-400" />
                              <span>Cancel Request</span>
                            </button>
                          )}

                          {friendshipStatus === 'PENDING_RECEIVED' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={handleAcceptFriendRequest}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" />
                                <span>Confirm</span>
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={handleCancelOrRejectRequest}
                                className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] text-slate-300 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}

                          {friendshipStatus === 'FRIENDS' && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setShowFriendMenu(!showFriendMenu)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <UserCheck className="w-4 h-4" />
                                <span>Friends ✓</span>
                                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                              </button>

                              {showFriendMenu && (
                                <div className="absolute left-0 sm:right-0 mt-2 w-44 bg-[#182032] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95">
                                  <button
                                    type="button"
                                    onClick={handleUnfriend}
                                    className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <UserX className="w-4 h-4" />
                                    <span>Unfriend</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Message Button */}
                          <Link
                            href={`/messages?user=${profileUser.id}`}
                            className="px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all border border-white/[0.08]"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>Message</span>
                          </Link>

                          {/* Direct Calling */}
                          <button
                            type="button"
                            onClick={() => handleStartCall('AUDIO')}
                            className="p-2.5 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 rounded-xl transition-all border border-white/[0.08] cursor-pointer"
                            title="Audio Call"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartCall('VIDEO')}
                            className="p-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl transition-all border border-emerald-500/30 cursor-pointer"
                            title="Video Call"
                          >
                            <Video className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={handleLudoInvite}
                            className="px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all border border-amber-500/30 cursor-pointer"
                            title="Send Ludo Challenge"
                          >
                            <span>🎲 Play Ludo</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Name, Bio, Stats */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                        {profileUser.displayName}
                      </h1>
                      {profileUser.isVerified && (
                        <CheckCircle2 className="w-5 h-5 text-rose-500 fill-rose-500 text-white" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <p className="text-xs text-slate-400">@{profileUser.username}</p>
                      {!isMe && (
                        (() => {
                          const isOnline = onlineUsers.includes(profileUser.id);
                          const lastSeen = userLastSeen[profileUser.id] || profileUser.lastSeenAt;
                          return isOnline ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>Active now</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/[0.06]">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              <span>{formatLastActive(lastSeen)}</span>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Bio Display */}
                    {profileUser.bio ? (
                      <p className="text-xs sm:text-sm text-slate-200 max-w-2xl mb-4 leading-relaxed font-normal whitespace-pre-line bg-white/[0.03] p-3.5 rounded-2xl border border-white/[0.06]">
                        {profileUser.bio}
                      </p>
                    ) : isMe ? (
                      <p
                        onClick={() => setIsEditProfileOpen(true)}
                        className="text-xs text-rose-400/80 mb-4 cursor-pointer hover:text-rose-300 transition-colors inline-block"
                      >
                        + Add a bio about yourself...
                      </p>
                    ) : null}

                    {/* Metadata details */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mb-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Joined: {formatDate(profileUser.createdAt)}</span>
                      </div>
                    </div>

                    {/* Stats: Posts & Friends (Facebook style) */}
                    <div className="flex items-center gap-6 py-3 border-t border-white/[0.08] text-sm">
                      <div>
                        <span className="font-extrabold text-white">{profileUser._count?.posts || 0}</span>{' '}
                        <span className="text-slate-400 text-xs">posts</span>
                      </div>
                      <Link href="/friends" className="hover:underline flex items-center gap-1.5 group cursor-pointer">
                        <span className="font-extrabold text-white group-hover:text-blue-400 transition-colors">
                          {friendsCount}
                        </span>{' '}
                        <span className="text-slate-400 text-xs">friends</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Facebook-Style 2-Column Section: Intro & Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
                {/* Left Column: Facebook-Style "Intro" Card (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/[0.08] shadow-xl">
                    <h2 className="font-extrabold text-white text-base mb-3.5 flex items-center justify-between">
                      <span>Intro</span>
                      {isMe && (
                        <button
                          onClick={() => setIsEditProfileOpen(true)}
                          className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    </h2>

                    {/* Bio with Edit / Add Bio button */}
                    {profileUser.bio ? (
                      <div className="mb-4">
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal whitespace-pre-line text-center bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                          {profileUser.bio}
                        </p>
                        {isMe && (
                          <button
                            onClick={() => setIsEditProfileOpen(true)}
                            className="w-full mt-2 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-white/[0.08] transition-all cursor-pointer"
                          >
                            Edit bio
                          </button>
                        )}
                      </div>
                    ) : isMe ? (
                      <button
                        onClick={() => setIsEditProfileOpen(true)}
                        className="w-full mb-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-500/20 transition-all cursor-pointer"
                      >
                        + Add bio
                      </button>
                    ) : null}

                    {/* Facebook Details Items */}
                    <div className="space-y-3 pt-2 border-t border-white/[0.06] text-xs">
                      {/* Works at */}
                      {profileUser.worksAt ? (
                        <div className="flex items-start gap-3 text-slate-300">
                          <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <span>
                            Works at <strong className="text-white font-semibold">{profileUser.worksAt}</strong>
                          </span>
                        </div>
                      ) : isMe ? (
                        <div
                          onClick={() => setIsEditProfileOpen(true)}
                          className="flex items-center gap-3 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer py-0.5"
                        >
                          <Briefcase className="w-4 h-4 shrink-0 text-slate-500" />
                          <span>+ Add workplace</span>
                        </div>
                      ) : null}

                      {/* Studied at / University */}
                      {profileUser.education ? (
                        <div className="flex items-start gap-3 text-slate-300">
                          <GraduationCap className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <span>
                            Studied at <strong className="text-white font-semibold">{profileUser.education}</strong>
                          </span>
                        </div>
                      ) : isMe ? (
                        <div
                          onClick={() => setIsEditProfileOpen(true)}
                          className="flex items-center gap-3 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer py-0.5"
                        >
                          <GraduationCap className="w-4 h-4 shrink-0 text-slate-500" />
                          <span>+ Add university / degree</span>
                        </div>
                      ) : null}

                      {/* Went to College */}
                      {profileUser.college ? (
                        <div className="flex items-start gap-3 text-slate-300">
                          <School className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <span>
                            Went to <strong className="text-white font-semibold">{profileUser.college}</strong>
                          </span>
                        </div>
                      ) : isMe ? (
                        <div
                          onClick={() => setIsEditProfileOpen(true)}
                          className="flex items-center gap-3 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer py-0.5"
                        >
                          <School className="w-4 h-4 shrink-0 text-slate-500" />
                          <span>+ Add college</span>
                        </div>
                      ) : null}

                      {/* Went to High School */}
                      {profileUser.school ? (
                        <div className="flex items-start gap-3 text-slate-300">
                          <School className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <span>
                            Went to <strong className="text-white font-semibold">{profileUser.school}</strong>
                          </span>
                        </div>
                      ) : isMe ? (
                        <div
                          onClick={() => setIsEditProfileOpen(true)}
                          className="flex items-center gap-3 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer py-0.5"
                        >
                          <School className="w-4 h-4 shrink-0 text-slate-500" />
                          <span>+ Add high school</span>
                        </div>
                      ) : null}

                      {/* Lives in */}
                      {profileUser.location ? (
                        <div className="flex items-start gap-3 text-slate-300">
                          <Home className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <span>
                            Lives in <strong className="text-white font-semibold">{profileUser.location}</strong>
                          </span>
                        </div>
                      ) : isMe ? (
                        <div
                          onClick={() => setIsEditProfileOpen(true)}
                          className="flex items-center gap-3 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer py-0.5"
                        >
                          <Home className="w-4 h-4 shrink-0 text-slate-500" />
                          <span>+ Add current city</span>
                        </div>
                      ) : null}

                      {/* From / Hometown */}
                      {profileUser.hometown ? (
                        <div className="flex items-start gap-3 text-slate-300">
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <span>
                            From <strong className="text-white font-semibold">{profileUser.hometown}</strong>
                          </span>
                        </div>
                      ) : isMe ? (
                        <div
                          onClick={() => setIsEditProfileOpen(true)}
                          className="flex items-center gap-3 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer py-0.5"
                        >
                          <MapPin className="w-4 h-4 shrink-0 text-slate-500" />
                          <span>+ Add hometown</span>
                        </div>
                      ) : null}

                      {/* Relationship status */}
                      {profileUser.relationship ? (
                        <div className="flex items-start gap-3 text-slate-300">
                          <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20 mt-0.5 shrink-0" />
                          <span className="text-white font-medium">{profileUser.relationship}</span>
                        </div>
                      ) : isMe ? (
                        <div
                          onClick={() => setIsEditProfileOpen(true)}
                          className="flex items-center gap-3 text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer py-0.5"
                        >
                          <Heart className="w-4 h-4 shrink-0 text-slate-500" />
                          <span>+ Add relationship status</span>
                        </div>
                      ) : null}

                      {/* Website */}
                      {profileUser.website ? (
                        <div className="flex items-start gap-3 text-slate-300">
                          <Globe className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <a
                            href={profileUser.website.startsWith('http') ? profileUser.website : `https://${profileUser.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline truncate"
                          >
                            {profileUser.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      ) : null}

                      {/* Joined Date */}
                      <div className="flex items-start gap-3 text-slate-400">
                        <Calendar className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                        <span>Joined {formatDate(profileUser.createdAt)}</span>
                      </div>
                    </div>

                    {/* Edit Details Button (Facebook Style) */}
                    {isMe && (
                      <button
                        onClick={() => setIsEditProfileOpen(true)}
                        className="w-full mt-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-white/[0.08] transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit details</span>
                      </button>
                    )}
                  </div>

                  {/* Facebook-Style Friends Card */}
                  <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/[0.08] shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="font-extrabold text-white text-base">Friends</h2>
                        <p className="text-xs text-slate-400">{friendsCount} friends</p>
                      </div>
                      <Link
                        href="/friends"
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        See all friends
                      </Link>
                    </div>

                    {friendsList.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">No friends to display</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {friendsList.map((f: any) => (
                          <Link
                            key={f.id}
                            href={`/profile/${f.username}`}
                            className="group flex flex-col items-center text-center p-1.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                          >
                            <UserAvatar
                              avatarUrl={f.avatarUrl}
                              name={f.displayName}
                              username={f.username}
                              size="md"
                              className="w-14 h-14 rounded-2xl ring-2 ring-white/10 group-hover:ring-blue-500 transition-all mb-1"
                            />
                            <span className="text-[11px] font-semibold text-slate-200 group-hover:text-blue-400 transition-colors line-clamp-1 w-full">
                              {f.displayName}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Tab Bar + Content (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Tab Navigation Bar */}
                  <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-1.5 border border-white/[0.08] shadow-xl flex items-center gap-1 overflow-x-auto scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setActiveTab('POSTS')}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'POSTS'
                          ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md shadow-rose-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>Posts ({profileUser.posts?.length || 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('LIVE')}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'LIVE'
                          ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md shadow-rose-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5 text-rose-400" />
                      <span>Live Replays ({profileUser.liveStreams?.length || 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('PHOTOS')}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'PHOTOS'
                          ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md shadow-rose-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Photos &amp; Videos</span>
                    </button>

                    {isMe && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('SAVED');
                          loadSavedPosts();
                        }}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          activeTab === 'SAVED'
                            ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md shadow-rose-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                        <span>Saved Moments</span>
                      </button>
                    )}
                  </div>

                  {/* 1. Posts Tab */}
                  {activeTab === 'POSTS' && (
                    <div className="space-y-4">
                      {profileUser.posts && profileUser.posts.length > 0 ? (
                        profileUser.posts.map((post: any) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            onDelete={() => {
                              setProfileUser((prev: any) =>
                                prev
                                  ? {
                                      ...prev,
                                      posts: prev.posts.filter((p: any) => p.id !== post.id),
                                      _count: {
                                        ...prev._count,
                                        posts: Math.max(0, (prev._count?.posts || 1) - 1),
                                      },
                                    }
                                  : null
                              );
                            }}
                          />
                        ))
                      ) : (
                        <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-8 border border-white/[0.08] text-center">
                          <p className="text-xs text-slate-400">This user hasn&apos;t shared any posts yet.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Live Replays Tab */}
                  {activeTab === 'LIVE' && (
                    <div className="space-y-4">
                      {profileUser.liveStreams && profileUser.liveStreams.length > 0 ? (
                        profileUser.liveStreams.map((stream: any) => (
                          <div
                            key={stream.id}
                            className="bg-[#111726]/90 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.08] shadow-xl hover:border-rose-500/30 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {stream.status === 'LIVE' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                      <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
                                      <span>LIVE NOW</span>
                                    </span>
                                  ) : stream.recordingUrl ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                      <Video className="w-3 h-3 text-indigo-400" />
                                      <span>Recorded Replay</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30 flex items-center gap-1">
                                      <Radio className="w-3 h-3 text-slate-400" />
                                      <span>Broadcast Ended</span>
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-400">
                                    {formatDate(stream.startedAt)}
                                  </span>
                                </div>
                                <h3 className="text-sm font-bold text-white pt-1">{stream.title}</h3>
                                <p className="text-xs text-slate-400 flex items-center gap-2 pt-0.5">
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Peak viewers: {stream.peakViewers || 1}</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {stream.status === 'LIVE' ? (
                                  <a
                                    href={`/live?id=${stream.id}`}
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/20 hover:opacity-95 transition-opacity cursor-pointer animate-pulse"
                                  >
                                    <Radio className="w-3 h-3 fill-white" />
                                    <span>Join Live</span>
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedReplay(stream)}
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/20 hover:opacity-95 transition-opacity cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 fill-white" />
                                    <span>Watch Replay</span>
                                  </button>
                                )}

                                {isMe && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLiveStream(stream.id)}
                                    className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer border border-white/[0.06]"
                                    title="Delete Recording"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-8 border border-white/[0.08] text-center space-y-2">
                          <Radio className="w-8 h-8 text-slate-600 mx-auto" />
                          <p className="text-xs text-slate-400">No live stream recordings yet.</p>
                          <p className="text-[11px] text-slate-500">
                            Broadcasts will automatically be saved and archived here permanently!
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Photos & Media Tab */}
                  {activeTab === 'PHOTOS' && (
                    <div>
                      {(() => {
                        const mediaItems: { url: string; postId: string }[] = [];
                        (profileUser.posts || []).forEach((p: any) => {
                          (p.mediaUrls || []).forEach((url: string) => {
                            mediaItems.push({ url, postId: p.id });
                          });
                        });

                        if (mediaItems.length === 0) {
                          return (
                            <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-8 border border-white/[0.08] text-center">
                              <p className="text-xs text-slate-400">No photos or videos uploaded yet.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {mediaItems.map((item, idx) => (
                              <div
                                key={idx}
                                className="relative aspect-square rounded-2xl overflow-hidden bg-black/60 border border-white/[0.08] group shadow-md"
                              >
                                {isVideoUrl(item.url) ? (
                                  <video
                                    src={resolveMediaUrl(item.url)}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={resolveMediaUrl(item.url)}
                                    alt="Media"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* 4. Saved Moments Tab */}
                  {activeTab === 'SAVED' && (
                    <div className="space-y-4">
                      {loadingSaved ? (
                        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                          Loading saved moments...
                        </div>
                      ) : savedPosts.length > 0 ? (
                        savedPosts.map((post: any) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            onDelete={() => {
                              setSavedPosts((prev) => prev.filter((p: any) => p.id !== post.id));
                            }}
                          />
                        ))
                      ) : (
                        <div className="bg-[#111726]/80 backdrop-blur-xl rounded-2xl p-8 border border-white/[0.08] text-center space-y-2">
                          <Bookmark className="w-8 h-8 text-slate-600 mx-auto" />
                          <p className="text-xs text-slate-400">No saved moments yet.</p>
                          <p className="text-[11px] text-slate-500">
                            Bookmark posts from your feed to view them here anytime!
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </>
          )}
        </main>
      </div>

      {/* ── 1. EDIT PROFILE MODAL (FACEBOOK STYLE) ───────────── */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-[#111726]/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/[0.1] text-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-500/25">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base leading-tight">
                    Edit Profile Details
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Customize your bio, education, workplace, and personal details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {editError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Basic Info</span>
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Display Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.displayName}
                    onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                    placeholder="Your full name"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-rose-500/50 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Bio
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={editFormData.bio}
                    onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                    placeholder="Describe who you are, your passions, or a favorite quote..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-rose-500/50 focus:outline-none transition-all resize-none"
                  />
                  <p className="text-[10px] text-slate-400 text-right mt-1">
                    {editFormData.bio.length} / 500 characters
                  </p>
                </div>
              </div>

              {/* Section 2: Work & Career */}
              <div className="space-y-4 pt-3 border-t border-white/[0.06]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Work &amp; Career</span>
                </h4>

                <AutocompleteInput
                  label="Works at (Job Title & Company)"
                  icon={<Briefcase className="w-4 h-4" />}
                  value={editFormData.worksAt}
                  onChange={(val) => setEditFormData({ ...editFormData, worksAt: val })}
                  placeholder="e.g. Software Engineer at Google or Founder & CEO"
                  suggestions={SUGGESTIONS.companies}
                />
              </div>

              {/* Section 3: Education & Study */}
              <div className="space-y-4 pt-3 border-t border-white/[0.06]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Education &amp; Study</span>
                </h4>

                <AutocompleteInput
                  label="University / Higher Education"
                  icon={<GraduationCap className="w-4 h-4" />}
                  value={editFormData.education}
                  onChange={(val) => setEditFormData({ ...editFormData, education: val })}
                  placeholder="e.g. University of Dhaka or BUET"
                  suggestions={SUGGESTIONS.universities}
                />

                <AutocompleteInput
                  label="College / Higher Secondary"
                  icon={<School className="w-4 h-4" />}
                  value={editFormData.college}
                  onChange={(val) => setEditFormData({ ...editFormData, college: val })}
                  placeholder="e.g. Notre Dame College, Dhaka"
                  suggestions={SUGGESTIONS.colleges}
                />

                <AutocompleteInput
                  label="High School"
                  icon={<School className="w-4 h-4" />}
                  value={editFormData.school}
                  onChange={(val) => setEditFormData({ ...editFormData, school: val })}
                  placeholder="e.g. St. Joseph Higher Secondary School"
                  suggestions={SUGGESTIONS.schools}
                />
              </div>

              {/* Section 4: Places Lived */}
              <div className="space-y-4 pt-3 border-t border-white/[0.06]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Places Lived</span>
                </h4>

                <AutocompleteInput
                  label="Current City (Lives in)"
                  icon={<Home className="w-4 h-4" />}
                  value={editFormData.location}
                  onChange={(val) => setEditFormData({ ...editFormData, location: val })}
                  placeholder="e.g. Dhaka, Bangladesh"
                  suggestions={SUGGESTIONS.cities}
                />

                <AutocompleteInput
                  label="Hometown (From)"
                  icon={<MapPin className="w-4 h-4" />}
                  value={editFormData.hometown}
                  onChange={(val) => setEditFormData({ ...editFormData, hometown: val })}
                  placeholder="e.g. Chittagong, Bangladesh"
                  suggestions={SUGGESTIONS.cities}
                />
              </div>


              {/* Section 5: Relationship & Social */}
              <div className="space-y-4 pt-3 border-t border-white/[0.06]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5" />
                  <span>Relationship &amp; Web</span>
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Relationship Status
                  </label>
                  <div className="relative">
                    <Heart className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={editFormData.relationship}
                      onChange={(e) => setEditFormData({ ...editFormData, relationship: e.target.value })}
                      className="w-full bg-[#182032] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:bg-[#1e273d] focus:border-rose-500/50 focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="">None / Prefer not to say</option>
                      <option value="Single">Single</option>
                      <option value="In a relationship">In a relationship</option>
                      <option value="Engaged">Engaged</option>
                      <option value="Married">Married</option>
                      <option value="In a civil partnership">In a civil partnership</option>
                      <option value="In an open relationship">In an open relationship</option>
                      <option value="It's complicated">It&apos;s complicated</option>
                      <option value="Separated">Separated</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Website or Social Link
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={editFormData.website}
                      onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                      placeholder="e.g. https://myportfolio.dev or github.com/raiyan"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-rose-500/50 focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Section 6: Privacy */}
              <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                <div>
                  <p className="text-xs font-bold text-white">Private Account</p>
                  <p className="text-[10px] text-slate-400">Only approved followers can see your posts and details</p>
                </div>
                <input
                  type="checkbox"
                  checked={editFormData.isPrivate}
                  onChange={(e) => setEditFormData({ ...editFormData, isPrivate: e.target.checked })}
                  className="w-4 h-4 rounded accent-rose-500 cursor-pointer"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2.5 border border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.06] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-500 via-rose-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-500/25 transition-all cursor-pointer flex items-center gap-2"
                >
                  {editLoading ? <span>Saving...</span> : <span>Save Details</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 2. CHANGE PASSWORD MODAL ──────────────────────────── */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                <span>Change Password</span>
              </h3>
              <button
                onClick={() => setIsChangePasswordOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-6 space-y-4">
              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={passwordFormData.currentPassword}
                    onChange={(e) =>
                      setPasswordFormData({ ...passwordFormData, currentPassword: e.target.value })
                    }
                    placeholder="Enter current password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-slate-800 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  New Password (at least 8 characters)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={passwordFormData.newPassword}
                    onChange={(e) =>
                      setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })
                    }
                    placeholder="Enter strong new password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-slate-800 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={passwordFormData.confirmPassword}
                  onChange={(e) =>
                    setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })
                  }
                  placeholder="Re-enter new password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-slate-800 focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {passwordLoading ? <span>Updating...</span> : <span>Update Password</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Replay Video Player Modal */}
      {selectedReplay && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#111726] border border-white/10 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-rose-400" />
                  Live Replay
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">{selectedReplay.title || 'Recorded Stream'}</h3>
                  <p className="text-[11px] text-slate-400">
                    Streamed on {formatDate(selectedReplay.startedAt)} • Peak viewers: {selectedReplay.peakViewers || 1}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedReplay.recordingUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = resolveMediaUrl(selectedReplay.recordingUrl);
                      link.download = `live_replay_${selectedReplay.id}.webm`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Download Replay"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedReplay(null)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video Player with Total Duration, Remaining Seconds, & Scrubber */}
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {selectedReplay.recordingUrl ? (
                <ReplayVideoPlayer
                  src={resolveMediaUrl(selectedReplay.recordingUrl)}
                  title={selectedReplay.title}
                  durationSeconds={
                    selectedReplay.durationSeconds ||
                    (selectedReplay.endedAt && selectedReplay.startedAt
                      ? Math.max(1, Math.round((new Date(selectedReplay.endedAt).getTime() - new Date(selectedReplay.startedAt).getTime()) / 1000))
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
                  <h4 className="text-base font-bold text-white">Live Replay Not Available</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    This live broadcast ended without a saved recording, or was interrupted before saving.
                  </p>
                </div>
              )}
            </div>

            {/* Recorded Live Comments & Interaction */}
            <div className="p-4 bg-slate-900/95 border-t border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-rose-400" />
                  Live & Replay Comments ({selectedReplay.comments?.length || 0})
                </span>
                <span className="text-[10px] text-slate-400">Preserved permanently</span>
              </div>

              {/* Comments Feed */}
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {!selectedReplay.comments || selectedReplay.comments.length === 0 ? (
                  <div className="text-center py-5 text-slate-400 text-xs">
                    No comments recorded during this broadcast yet. Be the first to leave a comment!
                  </div>
                ) : (
                  selectedReplay.comments.map((c: any) => (
                    <div key={c.id} className="flex items-start gap-2.5 text-xs bg-white/[0.03] p-2 rounded-xl border border-white/5">
                      <UserAvatar
                        avatarUrl={c.user?.avatarUrl}
                        name={c.user?.displayName || c.user?.username || 'User'}
                        size="xs"
                        className="mt-0.5"
                      />
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="font-bold text-rose-400 text-xs truncate">
                            {c.user?.displayName || c.user?.username || 'User'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-slate-200 text-xs leading-relaxed break-words">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input Form */}
              <form onSubmit={handleSendReplayComment} className="flex items-center gap-2 pt-2 border-t border-white/10">
                <input
                  type="text"
                  value={replayCommentInput}
                  onChange={(e) => setReplayCommentInput(e.target.value)}
                  placeholder="Write a comment on this replay..."
                  className="flex-1 bg-white/10 text-white placeholder-slate-400 text-xs px-3.5 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-rose-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!replayCommentInput.trim() || isPostingReplayComment}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:opacity-90 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserAvatar
                  avatarUrl={profileUser?.avatarUrl}
                  name={profileUser?.displayName}
                  size="xs"
                />
                <span className="text-xs font-semibold text-slate-200">{profileUser?.displayName}</span>
              </div>
              <a
                href={`/live?id=${selectedReplay.id}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <span>Open in Live Theater</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
