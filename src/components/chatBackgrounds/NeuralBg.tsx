"use client";
import { useEffect, useRef } from "react";

export default function NeuralBg() {
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

    type Node = {
      x: number; y: number;
      vx: number; vy: number;
      pulse: number;
      pulseSpeed: number;
    };

    const count = 28;
    const nodes: Node[] = [];
    const MAX_DIST = 160;

    const spawnNode = (): Node => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.02,
    });

    for (let i = 0; i < count; i++) nodes.push(spawnNode());

    // active signal: travels along an edge
    type Signal = {
      fromIdx: number;
      toIdx: number;
      progress: number; // 0 → 1
      speed: number;
    };
    const signals: Signal[] = [];

    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      // move nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += n.pulseSpeed;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      }

      // spawn signals occasionally
      if (frame % 45 === 0 && nodes.length > 1) {
        const fromIdx = Math.floor(Math.random() * nodes.length);
        // find a close neighbour
        let closest = -1;
        let closestD = Infinity;
        for (let i = 0; i < nodes.length; i++) {
          if (i === fromIdx) continue;
          const dx = nodes[i].x - nodes[fromIdx].x;
          const dy = nodes[i].y - nodes[fromIdx].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST && d < closestD) { closestD = d; closest = i; }
        }
        if (closest !== -1) {
          signals.push({ fromIdx, toIdx: closest, progress: 0, speed: 0.025 + Math.random() * 0.02 });
        }
      }

      // draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * 0.07;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(126, 231, 135, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // draw signals
      for (let i = signals.length - 1; i >= 0; i--) {
        const s = signals[i];
        s.progress += s.speed;
        if (s.progress >= 1) { signals.splice(i, 1); continue; }

        const from = nodes[s.fromIdx];
        const to = nodes[s.toIdx];
        const sx = from.x + (to.x - from.x) * s.progress;
        const sy = from.y + (to.y - from.y) * s.progress;

        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5);
        grd.addColorStop(0, "rgba(88, 166, 255, 0.7)");
        grd.addColorStop(1, "rgba(88, 166, 255, 0)");
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // draw nodes
      for (const n of nodes) {
        const pulse = (Math.sin(n.pulse) + 1) / 2;
        const alpha = 0.08 + pulse * 0.1;
        const r = 2.5 + pulse * 1.5;

        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3);
        grd.addColorStop(0, `rgba(126, 231, 135, ${alpha + 0.05})`);
        grd.addColorStop(1, `rgba(126, 231, 135, 0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(126, 231, 135, ${alpha + 0.1})`;
        ctx.fill();
      }
    };

    const interval = setInterval(draw, 33);
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