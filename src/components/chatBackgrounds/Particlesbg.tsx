"use client";
import { useEffect, useRef } from "react";

export default function ParticlesBg() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    type Particle = {
      x: number; y: number;
      vx: number; vy: number;
      char: string;
      alpha: number;
      size: number;
    };

    const chars = "01";
    const count = 55;
    const particles: Particle[] = [];

    const spawn = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      char: chars[Math.floor(Math.random() * chars.length)],
      alpha: Math.random() * 0.12 + 0.03,
      size: Math.random() > 0.85 ? 13 : 10,
    });

    for (let i = 0; i < count; i++) particles.push(spawn());

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `10px 'Fira Code', monospace`;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        // randomly flip bit
        if (Math.random() > 0.995) p.char = chars[Math.floor(Math.random() * chars.length)];

        ctx.font = `${p.size}px 'Fira Code', monospace`;
        ctx.fillStyle = `rgba(88, 166, 255, ${p.alpha})`;
        ctx.fillText(p.char, p.x, p.y);
      }
    };

    const interval = setInterval(draw, 40);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}