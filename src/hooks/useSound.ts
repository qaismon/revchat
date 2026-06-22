"use client";

import { useCallback, useRef } from "react";

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const beep = useCallback((freq: number, duration: number, type: OscillatorType = "square", vol = 0.06) => {
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch { /* audio not available */ }
  }, []);

  const playSend = useCallback(() => beep(520, 0.09, "square", 0.05), [beep]);
  const playReceive = useCallback(() => beep(640, 0.07, "square", 0.04), [beep]);

  return { playSend, playReceive };
}
