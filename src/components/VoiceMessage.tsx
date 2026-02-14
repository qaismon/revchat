"use client";
import React, { useState, useRef } from "react";

interface VoiceMessageProps {
  src: string;
}

export default function VoiceMessage({ src }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0); // Total seconds
  const [currentTime, setCurrentTime] = useState(0); // Current seconds
  const audioRef = useRef<HTMLAudioElement>(null);

  // Helper to format seconds into 0:00
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
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
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  return (
    <div style={{ 
      background: "#0D1117", 
      border: "1px solid #30363D", 
      borderRadius: "6px", 
      padding: "12px", 
      display: "flex", 
      alignItems: "center", 
      gap: "15px",
      minWidth: "280px", // Increased slightly for time display
      marginTop: "5px"
    }}>
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }} 
      />

      {/* Terminal Style Play Button */}
      <button 
        onClick={togglePlay}
        style={{
          background: isPlaying ? "#23863622" : "transparent",
          border: `1px solid ${isPlaying ? "#7EE787" : "#30363D"}`,
          color: "#7EE787",
          borderRadius: "4px",
          width: "35px",
          height: "35px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          transition: "all 0.2s ease",
          flexShrink: 0
        }}
      >
        {isPlaying ? "||" : "▶"}
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Animated Waveform */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "20px" }}>
          {[...Array(34)].map((_, i) => {
            const barThreshold = (i / 34) * 100;
            const isBarActive = progress >= barThreshold;
            return (
              <div 
                key={i} 
                style={{ 
                  width: "3px", 
                  height: isPlaying && isBarActive 
                    ? `${Math.random() * 80 + 20}%` 
                    : "20%", 
                  background: isBarActive ? "#7EE787" : "#30363D",
                  transition: "height 0.15s ease, background 0.1s ease",
                  borderRadius: "1px"
                }} 
              />
            );
          })}
        </div>
        
        {/* Status Text & Time Display */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontFamily: "monospace", color: "#8B949E" }}>
          <span>{isPlaying ? "STATUS: PLAYING..." : "STATUS: IDLE"}</span>
          <span style={{ color: "#7EE787" }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}