'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Heart,
  Sparkles,
  User as UserIcon,
  CheckCircle,
} from 'lucide-react';

interface AnimatedAuthCardProps {
  authTab: 'login' | 'register';
  setAuthTab: (tab: 'login' | 'register') => void;
  loginData: { login: string; password: string };
  setLoginData: React.Dispatch<React.SetStateAction<{ login: string; password: string }>>;
  registerData: {
    displayName: string;
    username: string;
    email: string;
    password: string;
  };
  setRegisterData: React.Dispatch<
    React.SetStateAction<{
      displayName: string;
      username: string;
      email: string;
      password: string;
    }>
  >;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  authLoading: boolean;
  authError: string;
  authSuccess: string;
  onLoginSubmit: (e: React.FormEvent) => void;
  onRegisterSubmit: (e: React.FormEvent) => void;
}

export function AnimatedAuthCard({
  authTab,
  setAuthTab,
  loginData,
  setLoginData,
  registerData,
  setRegisterData,
  showPassword,
  setShowPassword,
  authLoading,
  authError,
  authSuccess,
  onLoginSubmit,
  onRegisterSubmit,
}: AnimatedAuthCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Cycling romantic English quotes
  const quotes = [
    'In every heartbeat, only your name... Nusrat ❤️',
    'A sacred sanctuary of eternal love & profound respect ✨',
    'You are my answered prayer & cherished future wife 🌸',
    'The eternal realm of Raiyan & Nusrat • Nuraiyan 💫',
    'Bound together forever with unwavering love & devotion 💕',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [quotes.length]);

  // 3D Card Tilt Effect on Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Interactive Particle Canvas (Floating Hearts & Stardust)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle classes
    interface Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      fadeSpeed: number;
      type: 'heart' | 'star' | 'circle';
      color: string;
      angle: number;
      angularSpeed: number;
    }

    const colors = ['#f43f5e', '#fb7185', '#ec4899', '#f472b6', '#a855f7', '#fbbf24'];
    const particles: Particle[] = [];
    const maxParticles = 38;

    const createParticle = (originX?: number, originY?: number): Particle => {
      const typeChoice = Math.random();
      return {
        x: originX !== undefined ? originX : Math.random() * width,
        y: originY !== undefined ? originY : height + Math.random() * 20,
        size: Math.random() * 8 + 4,
        speedY: -(Math.random() * 0.8 + 0.3),
        speedX: (Math.random() - 0.5) * 0.6,
        opacity: Math.random() * 0.5 + 0.3,
        fadeSpeed: Math.random() * 0.003 + 0.001,
        type: typeChoice < 0.65 ? 'heart' : typeChoice < 0.85 ? 'star' : 'circle',
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.02,
      };
    };

    for (let i = 0; i < maxParticles; i++) {
      const p = createParticle();
      p.y = Math.random() * height;
      particles.push(p);
    }

    const drawHeart = (x: number, y: number, size: number, color: string, alpha: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;

      ctx.beginPath();
      const topCurveHeight = size * 0.3;
      ctx.moveTo(0, topCurveHeight);
      // top left curve
      ctx.bezierCurveTo(-size / 2, -topCurveHeight, -size, topCurveHeight / 3, 0, size);
      // top right curve
      ctx.bezierCurveTo(size, topCurveHeight / 3, size / 2, -topCurveHeight, 0, topCurveHeight);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawSparkle = (x: number, y: number, size: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;

      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(Math.cos(((i * 90) * Math.PI) / 180) * size, Math.sin(((i * 90) * Math.PI) / 180) * size);
        ctx.lineTo(
          Math.cos(((i * 90 + 45) * Math.PI) / 180) * (size * 0.35),
          Math.sin(((i * 90 + 45) * Math.PI) / 180) * (size * 0.35)
        );
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y * 0.02) * 0.4;
        p.angle += p.angularSpeed;
        p.opacity -= p.fadeSpeed;

        if (p.type === 'heart') {
          drawHeart(p.x, p.y, p.size, p.color, p.opacity, p.angle);
        } else if (p.type === 'star') {
          drawSparkle(p.x, p.y, p.size * 0.8, p.color, p.opacity);
        } else {
          ctx.save();
          ctx.globalAlpha = p.opacity * 0.8;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if (p.y < -20 || p.opacity <= 0 || p.x < -20 || p.x > width + 20) {
          particles[i] = createParticle();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.15s ease-out',
      }}
      className="w-full max-w-md relative select-none"
    >
      {/* ── 1. Cosmic Aurora & Pulsing Moving Glow Behind Card ── */}
      <div className="absolute -inset-2 bg-gradient-to-r from-rose-500/35 via-pink-500/30 to-purple-500/35 rounded-[36px] blur-2xl animate-love-glow pointer-events-none" />
      <div className="absolute -top-16 -right-16 w-52 h-52 bg-gradient-to-br from-rose-500/25 via-pink-400/20 to-transparent rounded-full blur-3xl pointer-events-none animate-aura-spin" />
      <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-gradient-to-tr from-purple-500/25 via-rose-500/20 to-transparent rounded-full blur-3xl pointer-events-none animate-aura-spin" />

      {/* ── 2. Rotating Conic Moving Border Container ── */}
      <div className="relative rounded-[30px] p-[2px] overflow-hidden shadow-[0_20px_50px_rgba(244,63,94,0.15)] group">
        {/* Continuous 360° Moving Rainbow/Rose Aurora Border */}
        <div
          className="absolute -inset-[150%] animate-spin-border pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
          style={{
            background:
              'conic-gradient(from 0deg, #f43f5e 0%, #ec4899 20%, #a855f7 40%, #6366f1 60%, #38bdf8 80%, #f43f5e 100%)',
          }}
        />

        {/* ── 3. Inner Frosted Glass Card ── */}
        <div className="relative rounded-[28px] bg-slate-950/90 border border-white/10 p-7 sm:p-8 backdrop-blur-3xl overflow-hidden">
          {/* Interactive Floating Particle Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-70"
          />

          {/* Top Glass Highlight Reflection */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-rose-300/60 to-transparent z-10" />

          {/* ── 4. Romantic Moving Quotes Ticker ── */}
          <div className="relative z-10 mb-5 text-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-200 text-[11px] font-medium shadow-xs backdrop-blur-md">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400 animate-heartbeat shrink-0" />
              <div className="h-4 overflow-hidden relative w-[240px] sm:w-[270px]">
                <div
                  key={quoteIndex}
                  className="transition-all duration-700 ease-out transform animate-gradient-text bg-gradient-to-r from-rose-200 via-pink-100 to-rose-300 bg-clip-text text-transparent font-semibold truncate"
                >
                  {quotes[quoteIndex]}
                </div>
              </div>
              <Sparkles className="w-3 h-3 text-pink-300 shrink-0" />
            </div>
          </div>

          {/* ── 5. Sliding Fluid Tab Selector ── */}
          <div className="relative z-10 flex p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 mb-6 shadow-inner">
            {/* Fluid Sliding Pill Background */}
            <div
              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 shadow-[0_4px_15px_rgba(244,63,94,0.4)] transition-all duration-300 ease-out ${
                authTab === 'login' ? 'left-1.5' : 'left-[calc(50%+3px)]'
              }`}
            />

            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
              }}
              className={`relative z-10 flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                authTab === 'login'
                  ? 'text-white drop-shadow-sm scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:scale-[1.01]'
              }`}
            >
              <Lock
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  authTab === 'login' ? 'text-white scale-110' : 'text-slate-500'
                }`}
              />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
              }}
              className={`relative z-10 flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                authTab === 'register'
                  ? 'text-white drop-shadow-sm scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:scale-[1.01]'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  authTab === 'register' ? 'text-white fill-white scale-110' : 'text-slate-500'
                }`}
              />
              <span>Create Account</span>
            </button>
          </div>

          {/* ── Status Messages ── */}
          {authError && (
            <div className="relative z-10 mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium text-center animate-shake backdrop-blur-md">
              {authError}
            </div>
          )}
          {authSuccess && (
            <div className="relative z-10 mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-medium text-center flex items-center justify-center gap-2 backdrop-blur-md">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* ── 6. Form Sections ── */}
          <div className="relative z-10">
            {authTab === 'login' ? (
              /* LOGIN FORM */
              <form onSubmit={onLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Username or Email</span>
                    <span className="text-[10px] text-rose-400/80">★ Secure</span>
                  </label>
                  <div className="relative group/input">
                    <Mail className="w-4 h-4 text-slate-500 group-focus-within/input:text-rose-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={loginData.login}
                      onChange={(e) => setLoginData({ ...loginData, login: e.target.value })}
                      placeholder="username or email"
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-300 backdrop-blur-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Password</span>
                    <a href="#" className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors">
                      Forgot?
                    </a>
                  </label>
                  <div className="relative group/input">
                    <Lock className="w-4 h-4 text-slate-500 group-focus-within/input:text-rose-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-300 backdrop-blur-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-slate-800 bg-slate-900 text-rose-500 focus:ring-0 accent-rose-500 cursor-pointer"
                    />
                    <span>Remember me</span>
                  </label>
                  <span className="text-slate-400 flex items-center gap-1.5 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Secure Session</span>
                  </span>
                </div>

                {/* Submit Button with Shimmer & Moving Glow */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="relative overflow-hidden group/btn w-full py-3 rounded-xl text-white font-bold text-xs shadow-[0_4px_25px_rgba(244,63,94,0.35)] bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:via-pink-600 hover:to-rose-700 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 transition-all duration-300 mt-4 cursor-pointer"
                >
                  {/* Shimmer Light Beam */}
                  <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 animate-shimmer pointer-events-none" />

                  {authLoading ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <Heart className="w-3.5 h-3.5 fill-white/50 group-hover/btn:scale-125 transition-transform duration-300" />
                      <span>Sign In & Enter</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={onRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative group/input">
                    <UserIcon className="w-4 h-4 text-slate-500 group-focus-within/input:text-rose-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={registerData.displayName}
                      onChange={(e) => setRegisterData({ ...registerData, displayName: e.target.value })}
                      placeholder="e.g. Raiyan Khan Joy"
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-300 backdrop-blur-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Username
                  </label>
                  <div className="relative group/input">
                    <span className="text-slate-500 group-focus-within/input:text-rose-400 font-bold absolute left-3.5 top-1/2 -translate-y-1/2 text-xs transition-colors">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      value={registerData.username}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                        })
                      }
                      placeholder="raiyan_joy"
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-300 backdrop-blur-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative group/input">
                    <Mail className="w-4 h-4 text-slate-500 group-focus-within/input:text-rose-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      placeholder="you@domain.com"
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-300 backdrop-blur-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Password (8+ chars)
                  </label>
                  <div className="relative group/input">
                    <Lock className="w-4 h-4 text-slate-500 group-focus-within/input:text-rose-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-300 backdrop-blur-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="relative overflow-hidden group/btn w-full py-3 rounded-xl text-white font-bold text-xs shadow-[0_4px_25px_rgba(244,63,94,0.35)] bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:via-pink-600 hover:to-rose-700 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 transition-all duration-300 mt-4 cursor-pointer"
                >
                  {/* Shimmer Light Beam */}
                  <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 animate-shimmer pointer-events-none" />

                  {authLoading ? (
                    <span>Creating Account...</span>
                  ) : (
                    <>
                      <Heart className="w-3.5 h-3.5 fill-white/50 group-hover/btn:scale-125 transition-transform duration-300" />
                      <span>Register & Enter</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* ── 7. Bottom Security & Eternal Love Seal ── */}
          <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
              <span>Argon2id Encrypted</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-rose-300/80 font-medium">
              <span>Raiyan</span>
              <Heart className="w-2.5 h-2.5 text-rose-400 fill-rose-400 animate-heartbeat" />
              <span>Nusrat</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
