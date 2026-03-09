"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "ai";
  text: string;
}

interface AskAIModalProps {
  contextMenu: { x: number; y: number; msgId: string; content: string } | null;
  onCloseContextMenu: () => void;
  onSendToChat: (text: string) => Promise<void>;
}

export default function AskAIModal({ contextMenu, onCloseContextMenu, onSendToChat }: AskAIModalProps) {
  const [modal, setModal] = useState<{ content: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const openModal = (content: string) => {
    setModal({ content });
    setMessages([{ role: "ai", text: `Context loaded. Ask me anything about this message.` }]);
    setQuery("");
    onCloseContextMenu();
  };

  const closeModal = () => {
    setModal(null);
    setMessages([]);
    setQuery("");
  };

  const handleAsk = async () => {
    if (!query.trim() || !modal || loading) return;
    const userMsg = query.trim();
    setQuery("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const history = messages
        .map(m => `${m.role === "user" ? "User" : "AI"}: ${m.text}`)
        .join("\n");

      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: modal.content,
          mode: "ASK",
          question: userMsg,
          history,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "ai", text: data.suggestion || "No response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "[ERROR: AI_UNAVAILABLE]" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Context Menu */}
      {contextMenu && (
        <div onClick={onCloseContextMenu} style={{ position: "fixed", inset: 0, zIndex: 100 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, background: "#161B22", border: "1px solid #30363D", borderRadius: "6px", zIndex: 101, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: "160px" }}
          >
            <button
              onClick={() => openModal(contextMenu.content)}
              style={{ width: "100%", padding: "10px 14px", background: "transparent", border: "none", color: "#58A6FF", fontSize: "12px", fontFamily: "'Fira Code', monospace", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={e => e.currentTarget.style.background = "#21262d"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              ⚡ Ask AI about this
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(contextMenu.content); onCloseContextMenu(); }}
              style={{ width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderTop: "1px solid #21262d", color: "#8B949E", fontSize: "12px", fontFamily: "'Fira Code', monospace", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={e => e.currentTarget.style.background = "#21262d"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              📋 Copy message
            </button>
          </div>
        </div>
      )}

      {/* Chatbot Modal */}
      {modal && (
        <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#0D1117", border: "1px solid #58A6FF", borderRadius: "8px", width: "500px", maxWidth: "92vw", height: "520px", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 0 40px rgba(88,166,255,0.15)", overflow: "hidden" }}
          >
            {/* Header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#161B22", flexShrink: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ color: "#58A6FF", fontSize: "12px", fontFamily: "'Fira Code', monospace", fontWeight: "bold" }}>⚡ ASK_AI // CONTEXT_MODE</span>
                <span style={{ color: "#484F58", fontSize: "10px", fontFamily: "'Fira Code', monospace" }}>
                  // ctx: {modal.content.substring(0, 50)}{modal.content.length > 50 ? "..." : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {messages.length > 1 && (
                  <button
                    onClick={async () => {
                      const last = [...messages].reverse().find(m => m.role === "ai" && m.text !== "Context loaded. Ask me anything about this message.");
                      if (last) { await onSendToChat(`### 🧠 LOGIC_EXPLAINED\n\n${last.text}`); closeModal(); }
                    }}
                    style={{ background: "#23863622", color: "#7EE787", border: "1px solid #238636", borderRadius: "4px", padding: "4px 10px", cursor: "pointer", fontFamily: "'Fira Code', monospace", fontSize: "10px" }}
                  >
                    SEND_TO_CHAT
                  </button>
                )}
                <button onClick={closeModal} style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: "4px",
                    fontSize: "13px",
                    fontFamily: "'Fira Code', monospace",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background: msg.role === "user" ? "#23863622" : "#161B22",
                    border: msg.role === "user" ? "1px solid #238636" : "1px solid #30363D",
                    color: msg.role === "user" ? "#7EE787" : "#C9D1D9",
                  }}>
                    <span style={{ fontSize: "10px", color: msg.role === "user" ? "#7EE787" : "#58A6FF", display: "block", marginBottom: "4px" }}>
                      {msg.role === "user" ? "> you" : "⚡ neural_engine"}
                    </span>
                    {msg.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ alignSelf: "flex-start", padding: "10px 14px", background: "#161B22", border: "1px solid #30363D", borderRadius: "4px", fontSize: "11px", color: "#484F58", fontFamily: "'Fira Code', monospace" }}>
                  ⚡ neural_engine // processing...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #21262d", background: "#161B22", display: "flex", gap: "8px", flexShrink: 0 }}>
              <input
                autoFocus
                placeholder="ask anything..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAsk(); if (e.key === "Escape") closeModal(); }}
                style={{ flex: 1, background: "#0D1117", border: "1px solid #30363D", borderRadius: "4px", padding: "8px 12px", color: "#C9D1D9", fontSize: "13px", fontFamily: "'Fira Code', monospace", outline: "none" }}
              />
              <button
                onClick={handleAsk}
                disabled={loading}
                style={{ background: loading ? "transparent" : "#58A6FF22", color: "#58A6FF", border: "1px solid #58A6FF", borderRadius: "4px", padding: "8px 16px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Fira Code', monospace", fontSize: "12px", fontWeight: "bold", flexShrink: 0 }}
              >
                {loading ? "..." : "ASK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}