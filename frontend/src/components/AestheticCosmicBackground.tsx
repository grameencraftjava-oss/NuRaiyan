'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  twinkleSpeed: number;
  color: string;
  vx: number;
  vy: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  color: string;
}

interface StardustMote {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  pulse: number;
  isHeart: boolean;
}

export function AestheticCosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile / low-power / touch device
    const checkIsMobile = () => {
      const mobile =
        window.innerWidth < 768 ||
        (typeof window !== 'undefined' &&
          ('ontouchstart' in window || navigator.maxTouchPoints > 0));
      setIsMobile(mobile);
      return mobile;
    };

    const mobile = checkIsMobile();

    // If mobile, do not initialize expensive canvas animation loop
    if (mobile) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates stored in refs (zero React re-renders)
    const mouse = { x: -1000, y: -1000 };
    const smoothMouse = { x: -1000, y: -1000 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate3d(${e.clientX - 300}px, ${e.clientY - 300}px, 0)`;
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      checkIsMobile();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Initialize optimized stars count
    const starColors = [
      'rgba(255, 255, 255, ',
      'rgba(251, 113, 133, ', // rose
      'rgba(192, 132, 252, ', // purple
      'rgba(253, 224, 71, ',  // warm gold
      'rgba(165, 180, 252, ', // soft indigo
    ];

    // Keep star count moderate (max 45) for ultra-high FPS (120+ FPS)
    const starCount = Math.min(45, Math.floor(width / 35));
    const stars: Star[] = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.6,
      baseAlpha: Math.random() * 0.5 + 0.2,
      alpha: Math.random() * 0.5 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.008,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
    }));

    // Shooting Stars
    const shootingStars: ShootingStar[] = [];
    const createShootingStar = () => {
      const colors = ['#f43f5e', '#a855f7', '#38bdf8', '#fbbf24', '#ffffff'];
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.25;
      shootingStars.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * height * 0.35,
        length: Math.random() * 60 + 60,
        speed: Math.random() * 10 + 8,
        angle,
        opacity: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    };

    // Stardust Motes
    const moteCount = 12;
    const motes: StardustMote[] = Array.from({ length: moteCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 1,
      speedY: -(Math.random() * 0.35 + 0.15),
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.4 + 0.15,
      pulse: Math.random() * Math.PI,
      isHeart: Math.random() > 0.6,
    }));

    let lastShootTime = Date.now();

    const drawHeart = (x: number, y: number, size: number, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      const topCurveHeight = size * 0.3;
      ctx.moveTo(0, topCurveHeight);
      ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurveHeight);
      ctx.bezierCurveTo(-size / 2, (size + topCurveHeight) / 2, 0, (size + topCurveHeight) / 1.4, 0, size);
      ctx.bezierCurveTo(0, (size + topCurveHeight) / 1.4, size / 2, (size + topCurveHeight) / 2, size / 2, topCurveHeight);
      ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurveHeight);
      ctx.closePath();
      ctx.fillStyle = `rgba(244, 63, 94, ${alpha})`;
      ctx.fill();
      ctx.restore();
    };

    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    // Main 60/120 FPS Render Loop (Zero Garbage Collection pressure)
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse interpolation
      if (mouse.x !== -1000) {
        smoothMouse.x = lerp(smoothMouse.x === -1000 ? mouse.x : smoothMouse.x, mouse.x, 0.08);
        smoothMouse.y = lerp(smoothMouse.y === -1000 ? mouse.y : smoothMouse.y, mouse.y, 0.08);
      }

      const now = Date.now();
      if (now - lastShootTime > 4000) {
        createShootingStar();
        lastShootTime = now;
      }

      // ── 1. Stars & Connections ──
      const starLen = stars.length;
      for (let i = 0; i < starLen; i++) {
        const s = stars[i];
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        s.alpha = s.baseAlpha + Math.sin(now * s.twinkleSpeed) * 0.2;
        let boostAlpha = Math.max(0.1, Math.min(0.9, s.alpha));

        if (smoothMouse.x !== -1000) {
          const dx = s.x - smoothMouse.x;
          const dy = s.y - smoothMouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 22500) { // 150px
            const dist = Math.sqrt(distSq);
            boostAlpha = Math.min(1, boostAlpha + (1 - dist / 150) * 0.4);
          }
        }

        // Draw Star Node (No expensive shadowBlur)
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `${s.color}${boostAlpha})`;
        ctx.fill();

        // Optimized constellation lines (check only next few neighbors)
        const checkLimit = Math.min(starLen, i + 6);
        for (let j = i + 1; j < checkLimit; j++) {
          const s2 = stars[j];
          const dx = s.x - s2.x;
          const dy = s.y - s2.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < 6400) { // 80px
            const dist = Math.sqrt(dSq);
            const lineAlpha = (1 - dist / 80) * 0.12 * Math.min(boostAlpha, s2.alpha);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.strokeStyle = `rgba(225, 29, 72, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // ── 2. Stardust Motes ──
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.y += m.speedY;
        m.x += m.speedX;
        m.pulse += 0.025;

        if (m.y < -15) {
          m.y = height + 15;
          m.x = Math.random() * width;
        }

        const currentOpacity = m.opacity * (0.6 + Math.sin(m.pulse) * 0.4);

        if (m.isHeart) {
          drawHeart(m.x, m.y, m.size * 2, currentOpacity * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${currentOpacity * 0.5})`;
          ctx.fill();
        }
      }

      // ── 3. Shooting Stars ──
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.opacity -= 0.02;

        if (ss.opacity <= 0 || ss.x > width + 50 || ss.y > height + 50) {
          shootingStars.splice(i, 1);
          continue;
        }

        const tailX = ss.x - Math.cos(ss.angle) * ss.length;
        const tailY = ss.y - Math.sin(ss.angle) * ss.length;

        const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        grad.addColorStop(0, ss.color);
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* ── 1. Cosmic Aurora Meshes (Hardware Accelerated & GPU Light) ── */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Top-Left Glowing Rose Orb */}
        <div
          className={`absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full opacity-60 ${
            isMobile ? 'blur-[80px]' : 'blur-[120px] animate-aurora-1'
          }`}
          style={{
            background:
              'radial-gradient(circle, rgba(244,63,94,0.3) 0%, rgba(225,29,72,0.12) 45%, transparent 75%)',
            willChange: isMobile ? 'auto' : 'transform',
          }}
        />

        {/* Top-Right Violet & Indigo Glow */}
        <div
          className={`absolute -top-24 -right-28 w-[520px] h-[520px] rounded-full opacity-55 ${
            isMobile ? 'blur-[80px]' : 'blur-[120px] animate-aurora-2'
          }`}
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.28) 0%, rgba(99,102,241,0.1) 45%, transparent 75%)',
            willChange: isMobile ? 'auto' : 'transform',
          }}
        />

        {/* Center-Lower Amber Glow (Desktop only) */}
        {!isMobile && (
          <div
            className="absolute top-1/2 left-1/3 -translate-x-1/2 w-[450px] h-[450px] rounded-full blur-[100px] opacity-40 animate-aurora-3"
            style={{
              background:
                'radial-gradient(circle, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.06) 50%, transparent 75%)',
              willChange: 'transform',
            }}
          />
        )}
      </div>

      {/* ── 2. Lightweight GPU-accelerated Cursor Spotlight (Desktop only) ── */}
      {!isMobile && (
        <div
          ref={spotlightRef}
          className="absolute -top-[1000px] -left-[1000px] w-[600px] h-[600px] rounded-full pointer-events-none opacity-40 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle, rgba(244, 63, 94, 0.12) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 70%)',
          }}
        />
      )}

      {/* ── 3. High-Precision Canvas (Active on Desktop, zero CPU on mobile) ── */}
      {!isMobile && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      )}

      {/* ── 4. Elegant Cyber Grid Overlay ── */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 85%)',
        }}
      />

      {/* ── 5. Luminous Top Border Shimmer ── */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
    </div>
  );
}
