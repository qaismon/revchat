"use client";
import { useEffect, useState } from "react";

export interface Toast {
  id: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  isGroup: boolean;
  groupName?: string;
  targetId: string; // userId for DM, groupId for group
  rawGroup?: any;   // full group object for groups
}

interface Props {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onNavigate: (toast: Toast) => void;
}

function SingleToast({ toast, onDismiss, onNavigate }: { toast: Toast; onDismiss: (id: string) => void; onNavigate: (t: Toast) => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Slide in
    const showTimer = setTimeout(() => setVisible(true), 10);

    // Auto-dismiss after 4s
    const hideTimer = setTimeout(() => handleDismiss(), 4500);

    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  // Truncate message preview
  const preview = toast.message.startsWith("AUDIO_PACKET:")
    ? "🎤 Voice message"
    : toast.message.replace(/```[\s\S]*?```/g, "{ code block }").slice(0, 55) + (toast.message.length > 55 ? "..." : "");

  const accent = toast.isGroup ? "#a78bfa" : "#58A6FF";
  const accentBg = toast.isGroup ? "#110d1f" : "#0d1829";
  const accentBorder = toast.isGroup ? "#2d1a5e" : "#1a3a6e";

  return (
    <div
      onClick={() => { onNavigate(toast); handleDismiss(); }}
      style={{
        width: "300px",
        background: "#0d1017",
        border: `1px solid ${accentBorder}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: "8px",
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px #ffffff04`,
        fontFamily: "'Fira Code', monospace",
        transform: visible && !leaving ? "translateX(0)" : "translateX(120%)",
        opacity: visible && !leaving ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, height: "2px", background: accentBg, width: "100%" }}>
        <div style={{
          height: "100%", background: accent, width: "100%",
          animation: "shrink-bar 4.5s linear forwards",
          transformOrigin: "left"
        }} />
      </div>

      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: accentBg, border: `1px solid ${accentBorder}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {toast.senderAvatar
            ? <img src={toast.senderAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ color: accent, fontWeight: "bold", fontSize: "13px" }}>{toast.senderName?.[0]?.toUpperCase()}</span>
          }
        </div>
        {/* Group/DM badge */}
        <div style={{ position: "absolute", bottom: "-3px", right: "-3px", fontSize: "8px", background: "#07090c", borderRadius: "4px", padding: "1px 2px", border: `1px solid ${accentBorder}` }}>
          {toast.isGroup ? "👥" : "💬"}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
          <span style={{ fontSize: "12px", color: accent, fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {toast.senderName?.toLowerCase()}
          </span>
          {toast.isGroup && toast.groupName && (
            <span style={{ fontSize: "9px", color: "#2d3440", whiteSpace: "nowrap" }}>in {toast.groupName?.toLowerCase()}</span>
          )}
        </div>
        <div style={{ fontSize: "11px", color: "#484F58", lineHeight: "1.4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Send a message
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        style={{ background: "none", border: "none", color: "#2d3440", cursor: "pointer", padding: "0", fontSize: "12px", flexShrink: 0, lineHeight: 1 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#8B949E")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#2d3440")}
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss, onNavigate }: Props) {
  return (
    <>
      <style>{`
        @keyframes shrink-bar {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
      <div style={{
        position: "fixed", top: "16px", right: "16px", zIndex: 9999,
        display: "flex", flexDirection: "column", gap: "8px",
        pointerEvents: "none",
      }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: "all" }}>
            <SingleToast toast={toast} onDismiss={onDismiss} onNavigate={onNavigate} />
          </div>
        ))}
      </div>
    </>
  );
}