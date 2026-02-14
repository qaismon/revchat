"use client";
import { useState } from "react";
import ChatList from "./ChatList";
import ChatBox from "./ChatBox";

export default function ChatPage({ userId }: { userId: string }) {
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  return (
    <div style={{ 
      display: "flex", 
      width: "100vw", 
      height: "100vh", 
      overflow: "hidden", 
      background: "#07090c" // Deepest background
    }}>
      {/* Sidebar - Fixed Width */}
      <div style={{ 
        width: "350px", 
        borderRight: "1px solid #30363D", // Darker border to match terminal theme
        background: "#07090c" 
      }}>
        <ChatList 
          currentUserId={userId} 
          onSelect={setSelectedPeer} 
          selectedUserId={selectedPeer} 
        />
      </div>

      {/* Chat Area - Full Height and Width */}
      <div style={{ flex: 1, height: "100%", background: "#07090c" }}>
        {selectedPeer ? (
          <ChatBox userId={userId} peerId={selectedPeer} />
        ) : (
          <div style={{ 
            display: "flex", 
            height: "100%", 
            alignItems: "center", 
            justifyContent: "center", 
            background: "#07090c",
            color: "#484F58", // Subtle gray text
            fontFamily: "'Fira Code', monospace",
            fontSize: "14px"
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#58A6FF", marginBottom: "8px" }}>❯ SYSTEM_READY</div>
              Select a contact to initialize session
            </div>
          </div>
        )}
      </div>
    </div>
  );
}