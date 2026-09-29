'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import {
  Settings,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  Laptop,
  Globe,
  LogOut,
  Check,
  AlertCircle,
  User,
  ShieldCheck,
  Volume2,
  VolumeX,
  Play,
  Square,
  Bell,
  Phone,
  MessageSquare,
  Sparkles,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api } from '../../lib/api';
import {
  CALL_TONES,
  MESSAGE_TONES,
  NOTIFICATION_TONES,
  DEFAULT_SOUND_SETTINGS,
  playCallRingtone,
  playMessageChime,
  playSystemNotification,
  SoundSettings,
} from '../../lib/soundUtils';

export default function SettingsPage() {
  const { currentUser, setCurrentUser, soundSettings, setSoundSettings } = useStore();
  const [activeTab, setActiveTab] = useState<'SECURITY' | 'PRIVACY' | 'SESSIONS' | 'SOUNDS'>('SECURITY');

  // Change Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // Privacy State
  const [isPrivate, setIsPrivate] = useState(currentUser?.isPrivate || false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState('');

  // Sessions State
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get('/auth/sessions');
      if (res.success && Array.isArray(res.data)) {
        setSessions(res.data);
      }
    } catch {} finally {
      setLoadingSessions(false);
    }
  };

  // Sound Preview State
  const [isPlayingCallPreview, setIsPlayingCallPreview] = useState(false);
  const [isPlayingMsgPreview, setIsPlayingMsgPreview] = useState(false);
  const [isPlayingNotifPreview, setIsPlayingNotifPreview] = useState(false);
  const stopCallRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (stopCallRef.current) {
        stopCallRef.current();
        stopCallRef.current = null;
      }
    };
  }, []);

  // Stop call preview when leaving sounds tab
  useEffect(() => {
    if (activeTab !== 'SOUNDS' && stopCallRef.current) {
      stopCallRef.current();
      stopCallRef.current = null;
      setIsPlayingCallPreview(false);
    }
  }, [activeTab]);

  const handleToggleCallPreview = (overrideTone?: string) => {
    if (isPlayingCallPreview && !overrideTone) {
      if (stopCallRef.current) {
        stopCallRef.current();
        stopCallRef.current = null;
      }
      setIsPlayingCallPreview(false);
    } else {
      if (stopCallRef.current) {
        stopCallRef.current();
      }
      const toneToPlay = overrideTone || soundSettings.callTone;
      const stop = playCallRingtone({ ...soundSettings, callTone: toneToPlay });
      stopCallRef.current = stop;
      setIsPlayingCallPreview(true);
      // Auto-stop call preview after 6 seconds if not stopped manually
      setTimeout(() => {
        if (stopCallRef.current === stop) {
          stop();
          stopCallRef.current = null;
          setIsPlayingCallPreview(false);
        }
      }, 6000);
    }
  };

  const handlePlayMsgPreview = (overrideTone?: string) => {
    setIsPlayingMsgPreview(true);
    playMessageChime({ ...soundSettings, messageTone: overrideTone || soundSettings.messageTone });
    setTimeout(() => setIsPlayingMsgPreview(false), 700);
  };

  const handlePlayNotifPreview = (overrideTone?: string) => {
    setIsPlayingNotifPreview(true);
    playSystemNotification({ ...soundSettings, notificationTone: overrideTone || soundSettings.notificationTone });
    setTimeout(() => setIsPlayingNotifPreview(false), 800);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    setPassLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword: oldPassword,
        newPassword,
      });

      if (res.success) {
        setPassSuccess('Password changed successfully! 🔒');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassError(res.message || 'Failed to change password.');
      }
    } catch {
      setPassError('Server error: Could not update password.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleTogglePrivacy = async (newVal: boolean) => {
    setPrivacyLoading(true);
    setPrivacySuccess('');
    try {
      const res = await api.patch('/users/profile', { isPrivate: newVal });
      if (res.success) {
        setIsPrivate(newVal);
        setPrivacySuccess(newVal ? 'Account set to Private 🔒' : 'Account set to Public 🌍');
        if (currentUser) {
          setCurrentUser({ ...currentUser, isPrivate: newVal });
        }
      }
    } catch {
      alert('Failed to update privacy setting.');
    } finally {
      setPrivacyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 flex gap-6">
        <Sidebar />

        <main className="flex-1 min-w-0 max-w-3xl mx-auto space-y-5">
          {/* Header Banner */}
          <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-white">Account Settings</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage your password, account privacy, and active devices
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-1.5 shadow-xl flex items-center gap-1">
            <button
              onClick={() => setActiveTab('SECURITY')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'SECURITY'
                  ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Password &amp; Security</span>
            </button>

            <button
              onClick={() => setActiveTab('PRIVACY')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'PRIVACY'
                  ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Privacy &amp; Visibility</span>
            </button>

            <button
              onClick={() => setActiveTab('SESSIONS')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'SESSIONS'
                  ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Devices ({sessions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('SOUNDS')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'SOUNDS'
                  ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Sound &amp; Ringtone</span>
            </button>
          </div>

          {/* TAB 1: Security & Password */}
          {activeTab === 'SECURITY' && (
            <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-6">
              <div className="border-b border-white/[0.06] pb-4">
                <h2 className="font-extrabold text-white text-base">Change Password</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Keep your account secure by using a strong, unique password.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                {passError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{passError}</span>
                  </div>
                )}
                {passSuccess && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{passSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Current Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-rose-500/50 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-rose-500/50 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:bg-white/[0.08] focus:border-rose-500/50 focus:outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? 'Hide Passwords' : 'Show Passwords'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={passLoading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-50"
                >
                  {passLoading ? 'Updating Password...' : 'Save New Password'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: Privacy */}
          {activeTab === 'PRIVACY' && (
            <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-6">
              <div className="border-b border-white/[0.06] pb-4">
                <h2 className="font-extrabold text-white text-base">Account Privacy</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Control who can see your photos, stories, and feed posts.
                </p>
              </div>

              {privacySuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{privacySuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span>Private Account</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md">
                    When your account is private, only approved followers can see your photos, videos, and full profile details.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={privacyLoading}
                  onClick={() => handleTogglePrivacy(!isPrivate)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                    isPrivate ? 'bg-rose-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      isPrivate ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Active Device Sessions */}
          {activeTab === 'SESSIONS' && (
            <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-6">
              <div className="border-b border-white/[0.06] pb-4">
                <h2 className="font-extrabold text-white text-base">Active Login Sessions</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Devices that are currently signed into your account.
                </p>
              </div>

              <div className="space-y-3">
                {sessions.length > 0 ? (
                  sessions.map((sess, idx) => (
                    <div
                      key={sess.id || idx}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-slate-300">
                          {sess.deviceType === 'mobile' ? (
                            <Smartphone className="w-5 h-5 text-rose-400" />
                          ) : (
                            <Laptop className="w-5 h-5 text-indigo-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{sess.deviceType === 'mobile' ? 'Mobile Browser' : 'Desktop Browser'}</span>
                            {idx === 0 && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                Current Active
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            IP: {sess.ipAddress || '127.0.0.1'} • {sess.userAgent?.slice(0, 30)}...
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Loading active sessions...</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Sound & Ringtone Settings */}
          {activeTab === 'SOUNDS' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-white text-base">Sound &amp; Ringtone Settings</h2>
                      <p className="text-xs text-slate-400">
                        Configure distinct ringtones, alert tones, and high-gain audio boosting for calls, messages, and notifications
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSoundSettings(DEFAULT_SOUND_SETTINGS);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white transition-all border border-white/[0.08] cursor-pointer"
                    title="Reset to default sound settings"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                </div>
              </div>

              {/* Super Loud Booster Card */}
              <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-500/30 rounded-3xl p-5 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                      <Zap className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-sm">Super Loud Mode (250% High-Gain Booster)</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {soundSettings.superLoud ? 'ACTIVE' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        Applies hardware-accelerated audio compression, treble maximizer, and 2.5x gain boost. Ensures you never miss any call or urgent message.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSoundSettings({ superLoud: !soundSettings.superLoud })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      soundSettings.superLoud ? 'bg-amber-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        soundSettings.superLoud ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 1. CALL RINGTONE SETTINGS */}
              <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Incoming Call Ringtone</h3>
                      <p className="text-xs text-slate-400">Custom ringing melody and volume for audio and video calls</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSoundSettings({ callEnabled: !soundSettings.callEnabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      soundSettings.callEnabled ? 'bg-rose-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        soundSettings.callEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {soundSettings.callEnabled && (
                  <div className="space-y-4">
                    {/* Tone Selection */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-2">Select Call Ringtone:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {CALL_TONES.map((tone) => {
                          const isSelected = soundSettings.callTone === tone.id;
                          return (
                            <button
                              key={tone.id}
                              onClick={() => {
                                setSoundSettings({ callTone: tone.id });
                                handleToggleCallPreview(tone.id);
                              }}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-lg shadow-rose-500/10'
                                  : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold flex items-center gap-1.5">
                                  <span>{tone.name}</span>
                                  {isSelected && <span className="text-[10px] text-rose-400">●</span>}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{tone.desc}</p>
                              </div>
                              <Play className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-rose-400' : 'text-slate-500'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Volume Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-rose-400" />
                          <span>Call Volume:</span>
                        </label>
                        <span className="text-xs font-bold text-rose-400 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          {soundSettings.callVolume}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={soundSettings.callVolume}
                        onChange={(e) => setSoundSettings({ callVolume: Number(e.target.value) })}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                    </div>

                    {/* Test Ringtone Button */}
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        onClick={() => handleToggleCallPreview()}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                          isPlayingCallPreview
                            ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400'
                            : 'bg-rose-500 hover:bg-rose-600 text-white'
                        }`}
                      >
                        {isPlayingCallPreview ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop Ringtone</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Test Call Ringtone</span>
                          </>
                        )}
                      </button>
                      <span className="text-[11px] text-slate-400">
                        {isPlayingCallPreview ? 'Ringtone is playing...' : 'Click to preview tone and loudness'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. CHAT MESSAGE SOUND SETTINGS */}
              <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Chat Message Alert</h3>
                      <p className="text-xs text-slate-400">Audio alert when receiving direct and group chat messages</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSoundSettings({ messageEnabled: !soundSettings.messageEnabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      soundSettings.messageEnabled ? 'bg-indigo-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        soundSettings.messageEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {soundSettings.messageEnabled && (
                  <div className="space-y-4">
                    {/* Tone Selection */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-2">Select Message Chime:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {MESSAGE_TONES.map((tone) => {
                          const isSelected = soundSettings.messageTone === tone.id;
                          return (
                            <button
                              key={tone.id}
                              onClick={() => {
                                setSoundSettings({ messageTone: tone.id });
                                handlePlayMsgPreview(tone.id);
                              }}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-indigo-500/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10'
                                  : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold flex items-center gap-1.5">
                                  <span>{tone.name}</span>
                                  {isSelected && <span className="text-[10px] text-indigo-400">●</span>}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{tone.desc}</p>
                              </div>
                              <Play className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Volume Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-indigo-400" />
                          <span>Message Volume:</span>
                        </label>
                        <span className="text-xs font-bold text-indigo-400 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                          {soundSettings.messageVolume}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={soundSettings.messageVolume}
                        onChange={(e) => setSoundSettings({ messageVolume: Number(e.target.value) })}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    {/* Test Message Sound Button */}
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        onClick={() => handlePlayMsgPreview()}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                          isPlayingMsgPreview
                            ? 'bg-indigo-600 text-white scale-95 ring-2 ring-indigo-400'
                            : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Test Message Sound</span>
                      </button>
                      <span className="text-[11px] text-slate-400">
                        {isPlayingMsgPreview ? 'Playing chime...' : 'Click to preview message alert sound'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. SYSTEM NOTIFICATION SOUND SETTINGS */}
              <div className="bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">System Notification Sound</h3>
                      <p className="text-xs text-slate-400">Alert sound for likes, comments, friend requests, and updates</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSoundSettings({ notificationEnabled: !soundSettings.notificationEnabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      soundSettings.notificationEnabled ? 'bg-emerald-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        soundSettings.notificationEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {soundSettings.notificationEnabled && (
                  <div className="space-y-4">
                    {/* Tone Selection */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-2">Select Notification Tone:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {NOTIFICATION_TONES.map((tone) => {
                          const isSelected = soundSettings.notificationTone === tone.id;
                          return (
                            <button
                              key={tone.id}
                              onClick={() => {
                                setSoundSettings({ notificationTone: tone.id });
                                handlePlayNotifPreview(tone.id);
                              }}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-lg shadow-emerald-500/10'
                                  : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold flex items-center gap-1.5">
                                  <span>{tone.name}</span>
                                  {isSelected && <span className="text-[10px] text-emerald-400">●</span>}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{tone.desc}</p>
                              </div>
                              <Play className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Volume Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                          <span>Notification Volume:</span>
                        </label>
                        <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          {soundSettings.notificationVolume}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={soundSettings.notificationVolume}
                        onChange={(e) => setSoundSettings({ notificationVolume: Number(e.target.value) })}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    {/* Test Notification Sound Button */}
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        onClick={() => handlePlayNotifPreview()}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                          isPlayingNotifPreview
                            ? 'bg-emerald-600 text-white scale-95 ring-2 ring-emerald-400'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Test Notification Sound</span>
                      </button>
                      <span className="text-[11px] text-slate-400">
                        {isPlayingNotifPreview ? 'Playing notification...' : 'Click to preview notification tone'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
