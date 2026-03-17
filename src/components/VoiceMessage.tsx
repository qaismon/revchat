"use client";
import React, { useState, useRef } from "react";

interface VoiceMessageProps {
  src: string;
}

export default function VoiceMessage({ src }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

const formatTime = (seconds: number) => {
  if (!seconds || !isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
 const togglePlay = async () => {
  if (!audioRef.current) return;
  try {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }
  } catch (err) {
    console.error("Playback error:", err);
    setIsPlaying(false);
  }
};

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setCurrentTime(current);
      setProgress((current / total) * 100);
    }
  };


  
 const handleLoadedMetadata = () => {
  if (!audioRef.current) return;
  const d = audioRef.current.duration;
  if (d && isFinite(d)) setDuration(d);
};

  return (
    <div
      style={{
        background: "#0D1117",
        border: "1px solid #30363D",
        borderRadius: "6px",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={() => {
  if (audioRef.current) {
    const d = audioRef.current.duration;
    if (d && isFinite(d)) setDuration(d);
  }
}}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
      />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        style={{
          background: isPlaying ? "#23863622" : "transparent",
          border: `1px solid ${isPlaying ? "#7EE787" : "#30363D"}`,
          color: "#7EE787",
          borderRadius: "4px",
          width: "32px",
          height: "32px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Fira Code', monospace",
          fontSize: "12px",
          transition: "all 0.2s ease",
          flexShrink: 0,
        }}
      >
        {isPlaying ? "||" : "▶"}
      </button>

      {/* Waveform + Status */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: "5px",
        }}
      >
        {/* Waveform Bars */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "2px",
            height: "18px",
            overflow: "hidden",
          }}
        >
          {[...Array(30)].map((_, i) => {
            const barThreshold = (i / 30) * 100;
            const isBarActive = progress >= barThreshold;
            return (
              <div
                key={i}
                style={{
                  width: "3px",
                  flexShrink: 0,
                  height:
                    isPlaying && isBarActive
                      ? `${Math.random() * 80 + 20}%`
                      : "25%",
                  background: isBarActive ? "#7EE787" : "#30363D",
                  transition: "height 0.15s ease, background 0.1s ease",
                  borderRadius: "1px",
                }}
              />
            );
          })}
        </div>

        {/* Status + Time */}
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
          <span style={{ color: "#7EE787" }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}