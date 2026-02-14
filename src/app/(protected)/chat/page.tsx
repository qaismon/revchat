"use client";

import { useEffect, useState } from "react";
import ChatBox from "@/components/ChatBox";
import ChatList from "@/components/ChatList";

export default function ChatPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((user) => {
        if (user?._id) {
          setCurrentUserId(user._id);
        }
      });
  }, []);

  // Styled Loading State
  if (!currentUserId) {
    return (
      <div style={{ 
        height: "100vh", 
        background: "#07090c", 
        color: "#7EE787", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        fontFamily: "'Fira Code', monospace" 
      }}>
        {">"} INITIALIZING_SYSTEM_CORE...
      </div>
    );
  }

  return (
    <div style={{ 
      display: "flex", 
      width: "100vw", 
      height: "100vh", 
      overflow: "hidden", 
      background: "#07090c" 
    }}>
      {/* Sidebar Wrapper */}
      <div style={{ width: "300px", height: "100%" }}>
        <ChatList
          currentUserId={currentUserId}
          onSelect={(id: string) => setPeerId(id)}
          selectedUserId={peerId} // Added this so the highlight works
        />
      </div>

      {/* Main Chat Content */}
      <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
        {peerId ? (
          <ChatBox userId={currentUserId} peerId={peerId} />
        ) : (
          <div style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            color: "#484F58", 
            fontFamily: "'Fira Code', monospace",
            fontSize: "14px",
            textAlign: "center"
          }}>
            <div>
              <div style={{ color: "#58A6FF", marginBottom: "8px" }}>❯ SESSION_IDLE</div>
              <div style={{ opacity: 0.8 }}>Select a contributor to begin review_session.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}