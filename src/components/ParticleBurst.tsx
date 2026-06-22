"use client";

import { useEffect, useRef } from "react";

interface Burst {
  id: number;
  x: number;
  y: number;
}

export function ParticleBurst({ burst }: { burst: Burst | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<any[]>([]);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!burst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const count = 18;
    const colors = ["#7EE787", "#58A6FF", "#a78bfa", "#f1e05a"];
    particlesRef.current = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      return {
        x: burst.x,
        y: burst.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        radius: 1.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
      };
    });

    const animate = () => {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;
      for (const p of particlesRef.current) {
        p.life -= p.decay;
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx * (1 / 60);
        p.y += p.vy * (1 / 60);
        p.vy += 200 * (1 / 60);
        ctx!.globalAlpha = p.life;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      if (alive) { frameRef.current = requestAnimationFrame(animate); }
    };
    animate();

    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [burst]);

  if (!burst) return null;
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
    />
  );
}
