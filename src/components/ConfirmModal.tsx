"use client";

import React from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "info" | "success";
}

export default function ConfirmModal({
  isOpen,
  title = "SYSTEM_CONFIRMATION",
  message,
  confirmText = "PROCEED",
  cancelText = "CANCEL",
  onConfirm,
  onCancel,
  variant = "danger",
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const colors = {
    danger: { border: "#F85149", bg: "rgba(248, 81, 73, 0.15)", text: "#F85149" },
    info: { border: "#58A6FF", bg: "rgba(88, 166, 255, 0.15)", text: "#58A6FF" },
    success: { border: "#7EE787", bg: "rgba(126, 231, 135, 0.15)", text: "#7EE787" },
  };

  const theme = colors[variant];

  return (
    <div style={{ 
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", 
      background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", 
      justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)", 
      fontFamily: "'Fira Code', monospace" 
    }}>
      {/* Animation Definitions */}
      <style>{`
        @keyframes terminal-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        @keyframes modal-slide-in {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ 
        background: "#0D1117", 
        border: `1px solid ${theme.border}`, 
        padding: "20px", 
        width: "90%", 
        maxWidth: "400px", 
        boxShadow: `0 0 30px ${theme.bg}`, 
        borderRadius: "4px",
        animation: "modal-slide-in 0.2s ease-out"
      }}>
        
        {/* Header Section */}
        <div style={{ 
          color: theme.text, 
          fontSize: "11px", 
          fontWeight: "bold", 
          marginBottom: "16px", 
          letterSpacing: "1px", 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          borderBottom: `1px solid ${theme.border}33`,
          paddingBottom: "8px"
        }}>
          <span style={{ animation: "terminal-pulse 1.5s infinite" }}>●</span> 
          [{title}]
        </div>

        {/* Message Content */}
        <div style={{ 
          color: "#C9D1D9", 
          fontSize: "13px", 
          marginBottom: "24px", 
          lineHeight: "1.6", 
          padding: "10px",
          background: "rgba(255,255,255,0.03)",
          borderLeft: `2px solid ${theme.border}`
        }}>
          <span style={{ color: theme.text, marginRight: "8px" }}>❯</span>
          {message}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button 
            onClick={onCancel}
            style={{ 
              background: "transparent", border: "1px solid #30363D", 
              color: "#8B949E", padding: "8px 16px", cursor: "pointer", 
              fontSize: "11px", fontFamily: "inherit", transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = "#484F58"}
            onMouseOut={(e) => e.currentTarget.style.borderColor = "#30363D"}
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            style={{ 
              background: theme.bg, border: `1px solid ${theme.border}`, 
              color: theme.text, padding: "8px 16px", cursor: "pointer", 
              fontSize: "11px", fontWeight: "bold", fontFamily: "inherit",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.background = theme.border + "33"}
            onMouseOut={(e) => e.currentTarget.style.background = theme.bg}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}