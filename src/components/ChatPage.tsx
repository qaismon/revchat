"use client";
import { useState } from "react";
import ChatList from "./ChatList";
import ChatBox from "./ChatBox";

export default function ChatPage({ userId }: { userId: string }) {
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar - Fixed Width */}
      <div style={{ width: "350px", borderRight: "1px solid #ddd", background: "#fff" }}>
        <ChatList currentUserId={userId} onSelect={setSelectedPeer} />
      </div>

      {/* Chat Area - Full Height and Width */}
      <div style={{ flex: 1, height: "100%" }}>
        {selectedPeer ? (
          <ChatBox userId={userId} peerId={selectedPeer} />
        ) : (
          <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", background: "#f0f2f5" }}>
            Select a contact to start chatting
          </div>
        )}
      </div>
    </div>
  );
}