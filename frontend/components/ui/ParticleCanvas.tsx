"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
  twinkle: number;
};

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxRaw = canvas.getContext("2d", { alpha: true });
    if (!ctxRaw) return;
    const ctx: CanvasRenderingContext2D = ctxRaw;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;

    function rand(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    function init() {
      const c = canvasRef.current;
      if (!c) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(110, Math.max(55, Math.floor((w * h) / 22000)));
      particles = Array.from({ length: count }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-0.22, 0.22),
        vy: rand(-0.32, -0.05),
        r: rand(0.7, 1.9),
        opacity: rand(0.35, 0.85),
        twinkle: rand(0, Math.PI * 2),
      }));
    }

    let tick = 0;

    function frame() {
      tick += 0.016;
      ctx.clearRect(0, 0, w, h);

      // subtle vignette handled by CSS bg; particles only
      for (const p of particles) {
        if (!prefersReduced) {
          p.x += p.vx;
          p.y += p.vy;
          p.twinkle += 0.015;

          // wrap-around
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;

          // gentle drift wobble
          p.x += Math.sin(tick * 0.3 + p.twinkle) * 0.08;
        }

        const flicker = 0.82 + Math.sin(p.twinkle) * 0.18;
        const alpha = p.opacity * flicker;

        // outer glow
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4.2);
        g.addColorStop(0, `rgba(180, 235, 255, ${alpha * 0.22})`);
        g.addColorStop(0.5, `rgba(0, 229, 255, ${alpha * 0.08})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4.2, 0, Math.PI * 2);
        ctx.fill();

        // core dot – white / pale cyan
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        // tiny cyan inner
        if (p.r > 1.2) {
          ctx.fillStyle = `rgba(120, 235, 255, ${alpha * 0.9})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ultra-subtle connecting lines for industrial network feel
      if (!prefersReduced) {
        ctx.lineWidth = 0.35;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i];
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 135) {
              const o = (1 - dist / 135) * 0.06;
              ctx.strokeStyle = `rgba(0, 229, 255, ${o})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    init();
    frame();

    const onResize = () => {
      init();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.6,
      }}
    />
  );
}
