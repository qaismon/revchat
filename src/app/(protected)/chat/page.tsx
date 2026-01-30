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

  if (!currentUserId) {
    return <p>Loading...</p>;
  }

  return (
  <div style={{display: "flex", height: "100vh", overflow: "hidden" }}>
  {currentUserId && (
    <ChatList
      currentUserId={currentUserId}
      onSelect={(id: string) => setPeerId(id)}
    />
  )}
  
      <div style={{ flex: 1, padding: 20 }}>
        {peerId ? (
          <ChatBox userId={currentUserId} peerId={peerId} />
        ) : (
          <p>Select a user to start chatting</p>
        )}
      </div>
    </div>
  );
}
