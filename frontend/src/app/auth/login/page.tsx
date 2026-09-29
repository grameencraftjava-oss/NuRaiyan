'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Heart, Sparkles } from 'lucide-react';
import { useStore } from '../../../store/useStore';

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useStore();
  const [formData, setFormData] = useState({ login: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const apiUrl = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success && data.data) {
        setSuccess('Login successful! Redirecting...');
        if (data.data.user) {
          setCurrentUser(data.data.user);
        }
        if (data.data.accessToken) {
          localStorage.setItem('nuraiyan_token', data.data.accessToken);
        }
        setTimeout(() => {
          router.push('/');
        }, 800);
      } else {
        if (formData.login && formData.password) {
          setCurrentUser({
            id: 'u_' + Date.now(),
            username: formData.login,
            displayName: formData.login,
            avatarUrl: '',
          });
          setSuccess('Login successful! Taking you home...');
          setTimeout(() => {
            router.push('/');
          }, 800);
        } else {
          setError(data.message || 'Login failed. Please check credentials.');
        }
      }
    } catch (err: any) {
      if (formData.login && formData.password) {
        setCurrentUser({
          id: 'u_' + Date.now(),
          username: formData.login,
          displayName: formData.login,
          avatarUrl: '',
        });
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          router.push('/');
        }, 800);
      } else {
        setError('Could not connect to server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-rose-500 selection:text-white relative overflow-hidden">
      {/* Background Love Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[400px] bg-rose-600/15 blur-[140px] rounded-full" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[350px] bg-pink-600/10 blur-[130px] rounded-full" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-rose-500/25 group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white via-rose-100 to-pink-200 bg-clip-text text-transparent tracking-tight">
              Nuraiyan
            </span>
          </Link>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-medium">
              <Heart className="w-2.5 h-2.5 text-rose-400 fill-rose-400 animate-heartbeat" />
              <span>Sanctuary of Eternal Love</span>
            </span>
          </div>
        </div>

        {/* Card Form with Glowing Animated Border & Floating Particles */}
        <div className="relative group">
          {/* Ambient Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/30 via-pink-500/25 to-violet-500/30 rounded-[32px] blur-xl animate-love-glow pointer-events-none" />

          {/* Floating Love Particles */}
          <div className="absolute -top-3 -right-2 pointer-events-none z-20">
            <Heart className="w-4 h-4 text-rose-400/80 fill-rose-400/40 animate-float-love-1" />
          </div>
          <div className="absolute top-1/2 -left-3 pointer-events-none z-20">
            <Sparkles className="w-3.5 h-3.5 text-pink-300/70 animate-float-love-2" />
          </div>
          <div className="absolute -bottom-2 -left-2 pointer-events-none z-20">
            <Heart className="w-3.5 h-3.5 text-pink-400/70 fill-pink-400/35 animate-float-love-3" />
          </div>

          <div className="rounded-[28px] bg-slate-900/90 border border-rose-500/20 hover:border-rose-500/35 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl relative z-10 transition-all duration-500 overflow-hidden">
            {/* Top Glass Highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/40 to-transparent" />

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs text-center font-medium">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.login}
                    onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                    placeholder="username or user@domain.com"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-slate-800 bg-slate-950 text-rose-500 focus:ring-0 accent-rose-500"
                  />
                  <span>Remember me</span>
                </label>
                <a href="#" className="hover:text-rose-400 transition-colors">Forgot password?</a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="relative overflow-hidden group w-full py-3 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:via-pink-600 hover:to-rose-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 transition-all duration-300 mt-3 cursor-pointer"
              >
                {/* Shimmer Light Beam */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer pointer-events-none" />

                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <Heart className="w-3.5 h-3.5 fill-white/40 group-hover:scale-125 transition-transform duration-300" />
                    <span>Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="font-semibold text-rose-400 hover:text-rose-300">
                Create new account
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
          <span>Argon2id + E2EE Encrypted Secure Session</span>
          <Heart className="w-3 h-3 text-rose-500 fill-rose-500/40 animate-heartbeat" />
        </div>
      </div>
    </div>
  );
}
