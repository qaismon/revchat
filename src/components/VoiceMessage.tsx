"use client";
import { useState, useRef, useCallback } from "react";

interface VoiceMessageProps {
  src: string;
}

const BAR_COUNT = 24;

const fmt = (s: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export default function VoiceMessage({ src }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const handleTimeUpdate = () => {
    const a = audioRef.current;
    if (a) {
      setCurrentTime(a.currentTime);
    }
  };

  const handleLoaded = () => {
    const a = audioRef.current;
    if (a && a.duration && isFinite(a.duration)) {
      setDuration(a.duration);
      setIsLoaded(true);
    }
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const togglePlay = useCallback(async () => {
    const a = audioRef.current;
    if (!a || hasError) return;
    try {
      if (isPlaying) {
        a.pause();
        setIsPlaying(false);
      } else {
        await a.play();
        setIsPlaying(true);
      }
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, hasError]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    const el = progressRef.current;
    if (!a || !el || !duration) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const t = Math.max(0, Math.min(x * duration, duration - 0.01));
    a.currentTime = t;
    setCurrentTime(t);
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        background: "#0D1117",
        border: "1px solid #30363D",
        borderRadius: "8px",
        padding: "8px 10px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "220px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onCanPlay={handleLoaded}
        onError={handleError}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        disabled={!isLoaded || hasError}
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "6px",
          border: `1px solid ${isPlaying ? "#7EE787" : "#30363D"}`,
          background: isPlaying ? "#23863622" : "transparent",
          color: hasError ? "#f85149" : "#7EE787",
          cursor: !isLoaded || hasError ? "not-allowed" : "pointer",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontFamily: "'Fira Code', monospace",
          transition: "all 0.2s ease",
          boxShadow: isPlaying ? "0 0 12px rgba(126,231,135,0.2)" : "none",
          position: "relative",
        }}
      >
        {hasError ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        ) : !isLoaded ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7EE787" strokeWidth="2.5" style={{ animation: "vm-spin 0.8s linear infinite" }}>
            <circle cx="12" cy="12" r="10" strokeDasharray="50" strokeDashoffset="15" strokeLinecap="round"/>
          </svg>
        ) : isPlaying ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        )}
      </button>

      {/* Bars + Progress */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
        {/* Waveform */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "1.5px",
            height: "24px",
            overflow: "hidden",
            cursor: isLoaded && !hasError ? "pointer" : "default",
            position: "relative",
          }}
          ref={progressRef}
          onClick={isLoaded && !hasError ? handleSeek : undefined}
        >
          {/* Progress highlight overlay */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${progress}%`,
              background: "#7EE78711",
              pointerEvents: "none",
              borderRadius: "2px",
              transition: "width 0.15s linear",
            }}
          />

          {Array.from({ length: BAR_COUNT }).map((_, i) => {
            const phase = (i / BAR_COUNT) * 100;
            const isActive = progress >= phase;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: "100%",
                  borderRadius: "1px",
                  background: isActive ? "#7EE787" : "#30363D",
                  position: "relative",
                  overflow: "hidden",
                  transition: "background 0.1s ease",
                }}
              >
                {/* Animated inner bar for active + playing */}
                {isActive && isPlaying && (
                  <div
                    className="vm-bar"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: "#7EE787",
                      borderRadius: "1px",
                      animation: `vm-bounce ${0.3 + (i % 5) * 0.08}s ease-in-out ${i * 0.04}s infinite alternate`,
                    }}
                  />
                )}
                {isActive && !isPlaying && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "50%",
                      background: "#7EE787",
                      borderRadius: "1px",
                    }}
                  />
                )}
                {!isActive && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "25%",
                      background: "#30363D",
                      borderRadius: "1px",
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* Seek indicator line */}
          {isLoaded && !hasError && (
            <div
              style={{
                position: "absolute",
                left: `${progress}%`,
                top: 0,
                bottom: 0,
                width: "1.5px",
                background: "#fff",
                opacity: 0.3,
                pointerEvents: "none",
                transition: "left 0.15s linear",
              }}
            />
          )}
        </div>

        {/* Time + status */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "9px",
            fontFamily: "'Fira Code', monospace",
            color: "#8B949E",
            whiteSpace: "nowrap",
          }}
        >
          {hasError ? (
            <span style={{ color: "#f85149" }}>Error loading audio</span>
          ) : !isLoaded ? (
            <span style={{ color: "#484F58" }}>Loading...</span>
          ) : (
            <>
              <span style={{ color: isPlaying ? "#7EE787" : "#8B949E" }}>
                {fmt(currentTime)} / {fmt(duration)}
              </span>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes vm-bounce {
          0%   { height: 20%; }
          100% { height: 90%; }
        }
        @keyframes vm-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}