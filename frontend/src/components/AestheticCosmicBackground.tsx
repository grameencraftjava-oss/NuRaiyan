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
  trail: { x: number; y: number }[];
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
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [smoothMouse, setSmoothMouse] = useState({ x: -1000, y: -1000 });

  // Mouse move listener with damping
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Smooth mouse interpolation loop
  useEffect(() => {
    let animId: number;
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    const updateSmoothMouse = () => {
      setSmoothMouse((prev) => ({
        x: lerp(prev.x === -1000 ? mousePos.x : prev.x, mousePos.x, 0.08),
        y: lerp(prev.y === -1000 ? mousePos.y : prev.y, mousePos.y, 0.08),
      }));
      animId = requestAnimationFrame(updateSmoothMouse);
    };

    animId = requestAnimationFrame(updateSmoothMouse);
    return () => cancelAnimationFrame(animId);
  }, [mousePos]);

  // Main Canvas Animation Loop (Starfield, Constellations, Shooting Stars, Rising Love Motes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize Stars
    const starColors = [
      'rgba(255, 255, 255, ',
      'rgba(251, 113, 133, ', // rose
      'rgba(192, 132, 252, ', // purple
      'rgba(253, 224, 71, ',  // warm gold
      'rgba(165, 180, 252, ', // soft indigo
    ];

    const starCount = Math.floor(Math.min(width, 1920) / 10);
    const stars: Star[] = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.6,
      baseAlpha: Math.random() * 0.6 + 0.2,
      alpha: Math.random() * 0.6 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.006,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
    }));

    // Shooting Stars
    const shootingStars: ShootingStar[] = [];
    const createShootingStar = () => {
      const colors = ['#f43f5e', '#a855f7', '#38bdf8', '#fbbf24', '#ffffff'];
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.3; // ~45 degrees diagonal
      shootingStars.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * height * 0.35,
        length: Math.random() * 80 + 70,
        speed: Math.random() * 12 + 10,
        angle,
        opacity: 1,
        trail: [],
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    };

    // Stardust Motes & Floating Love Glyphs
    const moteCount = 28;
    const motes: StardustMote[] = Array.from({ length: moteCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 3 + 1.5,
      speedY: -(Math.random() * 0.45 + 0.2),
      speedX: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.5 + 0.2,
      pulse: Math.random() * Math.PI,
      isHeart: Math.random() > 0.65,
    }));

    // Periodic shooting star trigger
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
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const now = Date.now();
      if (now - lastShootTime > Math.random() * 3000 + 2500) {
        createShootingStar();
        lastShootTime = now;
      }

      // ── 1. Render and Connect Star Constellations ───────────
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Drift slowly
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        // Twinkle
        s.alpha = s.baseAlpha + Math.sin(now * s.twinkleSpeed) * 0.25;
        const currentAlpha = Math.max(0.1, Math.min(1, s.alpha));

        // Subtle mouse repulsion / attraction
        const dx = s.x - smoothMouse.x;
        const dy = s.y - smoothMouse.y;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);
        let boostAlpha = currentAlpha;

        if (distToMouse < 180) {
          const proximityFactor = 1 - distToMouse / 180;
          boostAlpha = Math.min(1, currentAlpha + proximityFactor * 0.4);
        }

        // Draw Star Node
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `${s.color}${boostAlpha})`;
        ctx.shadowColor = s.color === 'rgba(251, 113, 133, ' ? '#f43f5e' : '#ffffff';
        ctx.shadowBlur = s.size > 1.4 ? 5 : 2;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Connect nearby stars with delicate constellation filaments
        for (let j = i + 1; j < stars.length; j++) {
          const s2 = stars[j];
          const dist = Math.hypot(s.x - s2.x, s.y - s2.y);
          if (dist < 85) {
            const lineAlpha = (1 - dist / 85) * 0.12 * Math.min(boostAlpha, s2.alpha);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.strokeStyle = `rgba(225, 29, 72, ${lineAlpha})`;
            ctx.lineWidth = 0.65;
            ctx.stroke();
          }
        }
      }

      // ── 2. Render Rising Stardust Motes & Hearts ────────────
      for (const m of motes) {
        m.y += m.speedY;
        m.x += m.speedX;
        m.pulse += 0.03;

        if (m.y < -20) {
          m.y = height + 20;
          m.x = Math.random() * width;
        }

        const currentOpacity = m.opacity * (0.6 + Math.sin(m.pulse) * 0.4);

        if (m.isHeart) {
          drawHeart(m.x, m.y, m.size * 2, currentOpacity * 0.7);
        } else {
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${currentOpacity * 0.6})`;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // ── 3. Render Shooting Stars with Luminous Tail ─────────
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.opacity -= 0.016;

        if (ss.opacity <= 0 || ss.x > width + 100 || ss.y > height + 100) {
          shootingStars.splice(i, 1);
          continue;
        }

        const tailX = ss.x - Math.cos(ss.angle) * ss.length;
        const tailY = ss.y - Math.sin(ss.angle) * ss.length;

        const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        grad.addColorStop(0, ss.color);
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = ss.color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Radiant head spark
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [smoothMouse]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* ── 1. Cosmic Aurora & Romantic Nebula Meshes ─────────── */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Top-Left Glowing Rose Quartz Orb */}
        <div
          className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full blur-[130px] opacity-70 animate-aurora-1"
          style={{
            background:
              'radial-gradient(circle, rgba(244,63,94,0.38) 0%, rgba(225,29,72,0.18) 45%, rgba(136,19,55,0.06) 70%, transparent 85%)',
          }}
        />

        {/* Top-Right Deep Violet & Indigo Cosmic Nebula */}
        <div
          className="absolute -top-24 -right-28 w-[620px] h-[620px] rounded-full blur-[140px] opacity-65 animate-aurora-2"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.34) 0%, rgba(99,102,241,0.16) 45%, rgba(67,56,202,0.05) 70%, transparent 85%)',
          }}
        />

        {/* Center-Lower Warm Honey & Golden Amber Glow */}
        <div
          className="absolute top-1/2 left-1/3 -translate-x-1/2 w-[550px] h-[550px] rounded-full blur-[125px] opacity-50 animate-aurora-3"
          style={{
            background:
              'radial-gradient(circle, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.09) 50%, transparent 75%)',
          }}
        />

        {/* Bottom-Right Velvet Fuchsia Aurora */}
        <div
          className="absolute -bottom-40 -right-24 w-[700px] h-[700px] rounded-full blur-[150px] opacity-60 animate-aurora-4"
          style={{
            background:
              'radial-gradient(circle, rgba(217,70,239,0.28) 0%, rgba(192,38,211,0.12) 50%, transparent 80%)',
          }}
        />

        {/* Diagonal Volumetric Light Beams */}
        <div
          className="absolute -top-[50%] left-1/4 w-[280px] h-[200%] opacity-20 transform -rotate-35 pointer-events-none animate-beam"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(251,113,133,0.15), rgba(168,85,247,0.1), transparent)',
            filter: 'blur(35px)',
          }}
        />
      </div>

      {/* ── 2. Interactive Spotlight Cursor Follower ─────────── */}
      <div
        className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(650px circle at ${smoothMouse.x}px ${smoothMouse.y}px, rgba(244, 63, 94, 0.12), rgba(139, 92, 246, 0.06), transparent 70%)`,
        }}
      />

      {/* ── 3. High-Precision Interactive Canvas ─────────────── */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* ── 4. Elegant Cyber-Romantic Grid Overlay ────────────── */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.25) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.25) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 75% 75% at 50% 50%, black 20%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 75% at 50% 50%, black 20%, transparent 85%)',
        }}
      />

      {/* ── 5. Concentric Celestial Rings (Sacred Geometry) ───── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full border border-rose-500/10 pointer-events-none animate-aura-spin" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[980px] h-[980px] rounded-full border border-dashed border-indigo-500/10 pointer-events-none animate-aura-spin" style={{ animationDuration: '45s', animationDirection: 'reverse' }} />

      {/* ── 6. Luminous Horizon Shimmer at Top ────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-gradient-to-b from-rose-500/10 via-rose-500/0 to-transparent blur-xl pointer-events-none" />

      {/* ── 7. Cinematic Noise Texture (Film Velvet Finish) ───── */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
