"use client";
import { useEffect, useRef } from "react";

function hexRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

interface Props { color?: string; highlight?: string; bgColor?: string; }

export default function NeuralBg({ color = "#7EE787", highlight = "#58A6FF", bgColor = "#07090c" }: Props) {
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

    const nodes: { x: number; y: number; vx: number; vy: number; pulse: number; pulseSpeed: number }[] = [];
    for (let i = 0; i < 28; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      });
    }

    let signals: { fromIdx: number; toIdx: number; progress: number; speed: number }[] = [];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        n.pulse += n.pulseSpeed;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      }

      const maxDist = 160;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.15;
            ctx.strokeStyle = hexRgba(color, alpha);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      if (Math.random() < 0.02 && nodes.length > 1) {
        const from = Math.floor(Math.random() * nodes.length);
        let to = Math.floor(Math.random() * nodes.length);
        while (to === from) to = Math.floor(Math.random() * nodes.length);
        signals.push({ fromIdx: from, toIdx: to, progress: 0, speed: 0.02 + Math.random() * 0.02 });
      }

      signals = signals.filter(s => s.progress < 1);
      for (const s of signals) {
        s.progress += s.speed;
        if (s.progress >= 1) continue;
        const from = nodes[s.fromIdx];
        const to = nodes[s.toIdx];
        if (!from || !to) continue;
        const x = from.x + (to.x - from.x) * s.progress;
        const y = from.y + (to.y - from.y) * s.progress;
        ctx.fillStyle = hexRgba(highlight, 0.6);
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const n of nodes) {
        const pulseAlpha = 0.15 + Math.sin(n.pulse) * 0.1;
        ctx.fillStyle = hexRgba(color, pulseAlpha);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3 + Math.sin(n.pulse) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const interval = setInterval(draw, 33);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, [color, highlight, bgColor]);

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
