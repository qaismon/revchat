"use client";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";

export default function ChatBox({ userId, peerId }: { userId: string, peerId: string }) {
  const socketRef = useSocket(userId);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [peerName, setPeerName] = useState("");
  const [peerAvatar, setPeerAvatar] = useState("");
  

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPeerTyping]);

  

  useEffect(() => {
    const loadChat = async () => {
      if (!userId || !peerId) return;
      const res = await fetch(`/api/messages?user1=${userId}&user2=${peerId}`);
      const data = await res.json();
      setMessages(data);
      socketRef.current?.emit("seen-messages", { senderId: peerId, receiverId: userId });
    
      // 2. FETCH USERNAME (Simplified addition)
    const userRes = await fetch(`/api/users/${peerId}`);
    const userData = await userRes.json();
    setPeerName(userData.username);
    setPeerAvatar(userData.avatar); // Capture the avatar URL
    };
    loadChat();
  }, [userId, peerId, socketRef]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (msg: any) => {
      const isRelevant = 
        (msg.senderId === userId && msg.receiverId === peerId) || 
        (msg.senderId === peerId && msg.receiverId === userId);

      if (isRelevant) {
        setMessages((prev) => [...prev, msg]);
        if (msg.senderId === peerId) {
          socket.emit("seen-messages", { senderId: peerId, receiverId: userId });
        }
      }
    };

    const handleSeen = ({ seenBy }: { seenBy: string }) => {
      if (seenBy === peerId) {
        setMessages((prev) => 
          prev.map(m => m.senderId === userId ? { ...m, seen: true } : m)
        );
      }
    };

    const handleTyping = ({ from, isTyping }: { from: string, isTyping: boolean }) => {
      if (from === peerId) {
        setIsPeerTyping(isTyping);
      }
    };

    socket.on("receive-message", handleMessage);
    socket.on("messages-seen", handleSeen);
    socket.on("display-typing", handleTyping);

    return () => {
      socket.off("receive-message", handleMessage);
      socket.off("messages-seen", handleSeen);
      socket.off("display-typing", handleTyping);
    };
  }, [userId, peerId, socketRef]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setText(e.target.value);

  // DEBUG LOG 1: Is the input even working?
  console.log("Input changed, sending typing status...");

  if (socketRef.current) {
    // DEBUG LOG 2: Is the socket connected?
    console.log("Socket found, emitting to room:", peerId);
    
    socketRef.current.emit("typing", { 
      to: peerId, 
      from: userId, 
      isTyping: true 
    });
  } else {
    console.error("Socket NOT found in socketRef!");
  }

  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  
  typingTimeoutRef.current = setTimeout(() => {
    console.log("Typing stopped, emitting false...");
    socketRef.current?.emit("typing", { to: peerId, from: userId, isTyping: false });
  }, 2000);
};

  const sendMessage = async () => {
    if (!text.trim()) return;
    
    const content = text;
    setText(""); 
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit("typing", { to: peerId, from: userId, isTyping: false });

    socketRef.current?.emit("send-message", { to: peerId, message: content, senderId: userId });

    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId: userId, receiverId: peerId, content }),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#e5ddd5", position: "relative" }}>
      <div style={{ padding: "10px 20px", background: "#075e54", color: "white", display: "flex", alignItems: "center", gap: "10px", zIndex: 10 }}>
        <div style={{ width: "35px", height: "35px", borderRadius: "50%", background: "#128c7e", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "bold" }}>
        {peerAvatar ? (
          <img src={peerAvatar} alt={peerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          peerName?.[0]?.toUpperCase() || peerName.slice(-1).toUpperCase()
        )}
      </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
<span style={{ fontWeight: "bold" }}>{peerName || "Loading..."}</span>          {isPeerTyping && <span style={{ fontSize: "11px", color: "#dcf8c6" }}>typing...</span>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {messages.map((m, i) => {
          const isMe = m.senderId === userId;
          return (
            <div key={i} style={{ 
              alignSelf: isMe ? "flex-end" : "flex-start",
              maxWidth: "70%", minWidth: "60px", padding: "8px 12px", borderRadius: "12px",
              background: isMe ? "#dcf8c6" : "#ffffff", boxShadow: "0 1px 1px rgba(0,0,0,0.1)"
            }}>
              <div style={{ fontSize: "14.5px", color: "#303030", paddingBottom: "4px" }}>{m.content}</div>
              <div style={{ fontSize: "10px", textAlign: "right", color: "#888", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "3px" }}>
                {new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {isMe && (
                  <span style={{ color: m.seen ? "#34b7f1" : "#999", fontSize: "12px", fontWeight: "bold" }}>
                    {m.seen ? "✓✓" : "✓"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        
        {isPeerTyping && (
           <div style={{ alignSelf: "flex-start", background: "#ffffff", padding: "8px 12px", borderRadius: "12px", boxShadow: "0 1px 1px rgba(0,0,0,0.1)", fontSize: "14px", color: "#888" }}>
             <span>...</span>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "10px 15px", background: "#f0f0f0", display: "flex", alignItems: "center", gap: "10px" }}>
        <input 
          style={{ flex: 1, padding: "12px 18px", borderRadius: "25px", border: "none", outline: "none", fontSize: "15px" }} 
          value={text} 
          onChange={handleInputChange} 
          onKeyDown={e => e.key === "Enter" && sendMessage()} 
          placeholder="Type a message..."
        />
        <button onClick={sendMessage} style={{ background: "#00a884", color: "white", border: "none", width: "45px", height: "45px", borderRadius: "50%", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}