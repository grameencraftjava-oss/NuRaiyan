'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Heart, Sparkles } from 'lucide-react';

interface FlyingHeart {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
}

export function AnimatedLoveLetter() {
  const [loveCount, setLoveCount] = useState(1314);
  const [flyingHearts, setFlyingHearts] = useState<FlyingHeart[]>([]);
  const [isLoved, setIsLoved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);

  // Trigger floating heart burst when heart icon clicked
  const handleLoveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsLoved(true);
    setLoveCount((prev) => prev + 1);

    const rect = e.currentTarget.getBoundingClientRect();
    const newHearts: FlyingHeart[] = [];
    const colors = ['#f43f5e', '#fb7185', '#ec4899', '#f472b6', '#fda4af', '#fcd34d'];

    for (let i = 0; i < 6; i++) {
      newHearts.push({
        id: Date.now() + i + Math.random(),
        x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 30,
        y: rect.top + (Math.random() - 0.5) * 20,
        size: Math.random() * 16 + 14,
        rotation: (Math.random() - 0.5) * 45,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    setFlyingHearts((prev) => [...prev, ...newHearts]);

    setTimeout(() => {
      setFlyingHearts((prev) => prev.filter((h) => !newHearts.includes(h)));
    }, 1800);
  };

  // Canvas: Falling Rose Petals & Stardust drifting gently
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Petal {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      angle: number;
      angularSpeed: number;
      opacity: number;
      color: string;
      swayFreq: number;
    }

    const petals: Petal[] = [];
    const maxPetals = 22;
    const petalColors = ['#f43f5e', '#fb7185', '#fda4af', '#f472b6', '#fbcfe8'];

    const createPetal = (startY?: number): Petal => ({
      x: Math.random() * width,
      y: startY !== undefined ? startY : -10 - Math.random() * 20,
      size: Math.random() * 8 + 6,
      speedY: Math.random() * 0.7 + 0.4,
      speedX: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI * 2,
      angularSpeed: (Math.random() - 0.5) * 0.025,
      opacity: Math.random() * 0.4 + 0.25,
      color: petalColors[Math.floor(Math.random() * petalColors.length)],
      swayFreq: Math.random() * 0.02 + 0.01,
    });

    for (let i = 0; i < maxPetals; i++) {
      petals.push(createPetal(Math.random() * height));
    }

    const drawPetal = (x: number, y: number, size: number, angle: number, color: string, opacity: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
      ctx.fillStyle = color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;

      // Draw elegant organic petal
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.8, -size * 0.5, size * 0.8, size * 0.5, 0, size);
      ctx.bezierCurveTo(-size * 0.8, size * 0.5, -size * 0.8, -size * 0.5, 0, -size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y * p.swayFreq) * 0.6;
        p.angle += p.angularSpeed;

        drawPetal(p.x, p.y, p.size, p.angle, p.color, p.opacity);

        if (p.y > height + 20 || p.x < -20 || p.x > width + 20) {
          petals[i] = createPetal();
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div ref={letterRef} className="flex-1 w-full max-w-2xl relative select-none">
      {/* ── Ambient Floating Heart Bursts on click ── */}
      {flyingHearts.map((heart) => (
        <div
          key={heart.id}
          style={{
            position: 'fixed',
            left: `${heart.x}px`,
            top: `${heart.y}px`,
            transform: `translate(-50%, -50%) rotate(${heart.rotation}deg)`,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="animate-float-heart transition-all"
        >
          <Heart style={{ width: heart.size, height: heart.size, color: heart.color, fill: heart.color }} />
        </div>
      ))}

      {/* ── Soft Ambient Background Warmth ── */}
      <div className="absolute -inset-2 bg-gradient-to-br from-rose-950/20 via-pink-950/15 to-transparent rounded-[36px] blur-2xl pointer-events-none" />

      {/* ── The Illuminated Love Letter Container ── */}
      <div className="relative rounded-[32px] bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-rose-500/20 hover:border-rose-500/35 p-8 sm:p-10 shadow-2xl backdrop-blur-2xl overflow-hidden transition-all duration-500 group">
        {/* Living Falling Rose Petal Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80" />

        {/* Top Gold & Rose Light Ribbon */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-rose-400/60 to-transparent" />

        {/* ── Dedication Badge ── */}
        <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs font-semibold mb-6 shadow-xs backdrop-blur-md">
          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-heartbeat shrink-0" />
          <span>A Heartfelt Gift from Raiyan Khan Joy to Nusrat Jahan</span>
          <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
        </div>

        {/* ── Letter Heading with Shimmering Gradient ── */}
        <div className="relative z-10 mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
            To My Adorable Future Wife, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-rose-300 via-pink-200 to-amber-200 bg-clip-text text-transparent animate-gradient-text">
              Nusrat Jahan...
            </span>
          </h2>
        </div>

        {/* ── The Written Letter with Living Border Line ── */}
        <div className="relative z-10 space-y-4 text-slate-300 text-xs sm:text-sm leading-relaxed sm:leading-loose font-normal border-l-2 border-rose-500/40 pl-5 my-6">
          <p className="p-2 rounded-xl transition-all duration-300 hover:bg-white/[0.03] hover:text-white">
            From the moment you entered my world, every chapter of my life found peace, purpose, and genuine beauty.
            You are not only my greatest happiness today, but also my answered prayer and my cherished future wife.
          </p>

          <p className="p-2 rounded-xl transition-all duration-300 hover:bg-white/[0.03] hover:text-white">
            As an eternal token of my profound love, utmost respect, and lifelong devotion, I crafted this platform—
            <strong className="text-rose-200 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
              ‘Nuraiyan’
            </strong>
            —weaving both our names into one everlasting sanctuary of love.
          </p>

          <p className="p-2 rounded-xl transition-all duration-300 hover:bg-white/[0.03] hover:text-white">
            Through every triumph and challenge life brings, I promise to hold your hand with unwavering warmth, honor
            your dreams, and cherish your gentle smile for all the days of my life.
          </p>
        </div>

        {/* ── Signature & Interactive Love Heart Reaction Button ── */}
        <div className="relative z-10 pt-5 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs text-rose-300/80 font-medium">With endless love &amp; devotion—</p>
            <p className="text-sm font-bold text-white tracking-wide mt-0.5 flex items-center gap-1.5">
              <span>Raiyan Khan Joy</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold">
                Forever Yours
              </span>
            </p>
          </div>

          {/* Interactive Love Button */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              <span className="text-rose-400 font-bold">{loveCount.toLocaleString()}</span> Love Beats
            </span>
            <button
              type="button"
              onClick={handleLoveClick}
              title="Click to send love to Nusrat!"
              className="w-11 h-11 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-400 flex items-center justify-center text-rose-400 hover:text-rose-300 active:scale-90 transition-all duration-200 shadow-lg shadow-rose-500/20 cursor-pointer group/btn"
            >
              <Heart
                className={`w-5 h-5 transition-transform duration-200 ${
                  isLoved ? 'fill-rose-500 text-rose-500 scale-125' : 'fill-rose-500/30 group-hover/btn:scale-115'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
