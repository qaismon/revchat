"use client";

import type { CallState } from "@/types";

interface VoiceCallOverlayProps {
  callState: CallState;
  remoteStream: MediaStream | null;
  callPeerName: string;
  isMuted: boolean;
  callDuration: number;
  onAnswer: () => void;
  onEnd: () => void;
  onDecline: () => void;
  onToggleMute: () => void;
}

function fmt(d: number) {
  const m = Math.floor(d / 60);
  const s = d % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function VoiceCallOverlay({
  callState, remoteStream, callPeerName, isMuted, callDuration,
  onAnswer, onEnd, onDecline, onToggleMute,
}: VoiceCallOverlayProps) {
  if (callState === "idle") return null;

  return (
    <>
      {/* Incoming call */}
      {callState === "incoming" && (
        <div className="fixed top-0 left-0 right-0 z-[9999] animate-slideDown">
          <div className="mx-auto max-w-md mt-3 rounded-2xl overflow-hidden si" style={{background:"#0a0c10",border:"1px solid #1a3a6e",boxShadow:"0 20px 60px rgba(0,0,0,0.9)"}}>
            <div className="h-0.5 w-full" style={{background:"linear-gradient(90deg,#58A6FF,transparent)"}}/>
            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{background:"#0a1628",border:"1px solid #1a3a6e"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#E6EDF3] truncate">{callPeerName.toLowerCase()}</div>
                <div className="text-[10px] text-[#58A6FF] font-medium tracking-wider" style={{animation:"pulseGlow 1.5s ease-in-out infinite"}}>INCOMING CALL</div>
              </div>
              <button onClick={onAnswer} className="btn w-10 h-10 rounded-xl flex items-center justify-center" style={{background:"#0d2218",border:"1px solid #238636",color:"#7EE787"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </button>
              <button onClick={onDecline} className="btn w-10 h-10 rounded-xl flex items-center justify-center" style={{background:"#1a0a0a",border:"1px solid #3a1010",color:"#f85149"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing call */}
      {callState === "calling" && (
        <div className="fixed top-0 left-0 right-0 z-[9999] animate-slideDown">
          <div className="mx-auto max-w-md mt-3 rounded-2xl overflow-hidden si" style={{background:"#0a0c10",border:"1px solid #1a3a6e",boxShadow:"0 20px 60px rgba(0,0,0,0.9)"}}>
            <div className="h-0.5 w-full" style={{background:"linear-gradient(90deg,#58A6FF,transparent)"}}/>
            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{background:"#0a1628",border:"1px solid #1a3a6e"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[#E6EDF3] truncate">{callPeerName.toLowerCase()}</div>
                <div className="text-[10px] text-[#484F58] font-medium tracking-wider">CALLING...</div>
              </div>
              <button onClick={onEnd} className="btn w-10 h-10 rounded-xl flex items-center justify-center" style={{background:"#1a0a0a",border:"1px solid #3a1010",color:"#f85149"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected call */}
      {callState === "connected" && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] animate-fadeIn">
          <audio ref={(el) => {
            if (el && remoteStream) {
              el.srcObject = remoteStream;
              el.play().catch((e) => console.error("[Audio] play failed:", e));
            }
          }} autoPlay playsInline />
          <div className="rounded-2xl overflow-hidden si" style={{background:"rgba(10,12,16,0.95)",border:"1px solid #238636",boxShadow:"0 10px 40px rgba(0,0,0,0.8)",backdropFilter:"blur(12px)"}}>
            <div className="h-0.5 w-full" style={{background:"linear-gradient(90deg,#238636,#7EE787)"}}/>
            <div className="px-5 py-3 flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#7EE787]" style={{animation:"pulseGlow 2s ease-in-out infinite"}}/>
                <span className="text-[12px] font-bold text-[#7EE787] tracking-wider">{callPeerName.toLowerCase()}</span>
              </div>
              <span className="text-[11px] text-[#484F58] font-mono">{fmt(callDuration)}</span>
              <button onClick={onToggleMute} className="btn w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{background:isMuted?"#1a0a0a":"#0a0c10",border:`1px solid ${isMuted?"#3a1010":"#1a1f2e"}`,color:isMuted?"#f85149":"#8B949E"}}>
                {isMuted
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                }
              </button>
              <button onClick={onEnd} className="btn w-9 h-9 rounded-xl flex items-center justify-center" style={{background:"#1a0a0a",border:"1px solid #3a1010",color:"#f85149"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ended call */}
      {callState === "ended" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-fadeIn">
          <div className="rounded-2xl px-5 py-2.5 si" style={{background:"rgba(10,12,16,0.95)",border:"1px solid #1a1f2e"}}>
            <span className="text-[11px] text-[#484F58] font-medium">Call ended · {fmt(callDuration)}</span>
          </div>
        </div>
      )}
    </>
  );
}
