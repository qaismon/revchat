"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import CodeReviewer from "./CodeReviewer";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useUploadThing } from "@/utils/uploadthing"; // ← NEW



// --- E2EE CRYPTO HELPERS ---
async function importPublicKey(pem: string) {
  const binaryDer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}
async function importPrivateKey(pem: string) {
  const binaryDer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export default function ChatBox({ userId, peerId }: { userId: string, peerId: string }) {
  const socketRef = useSocket(userId);
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [peerName, setPeerName] = useState("");
  const [peerAvatar, setPeerAvatar] = useState("");
  
  // --- E2EE STATE ---
  const [peerPublicKey, setPeerPublicKey] = useState<string | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});
  const [grepQuery, setGrepQuery] = useState("");
  const [isGrepActive, setIsGrepActive] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewData, setReviewData] = useState({ id: "", code: "", comments: "" });

  // ← NEW: UploadThing hook for voice messages
  const { startUpload: uploadVoice, isUploading: isUploadingVoice } = useUploadThing("voiceUploader");

const requestAIDescription = async (msgId: string, rawCode: string) => {
  try {
    const cleanCode = rawCode
      .replace(/### 🧠 LOGIC_EXPLAINED/g, "")
      .replace(/\[SYSTEM_DIAGNOSTIC_REPORT\].*/g, "")
      .trim();

    if (!cleanCode || cleanCode.includes("Analyzing logic flow")) {
      console.error("No valid code found for analysis");
      return;
    }

    const aiMsgId = `ai-desc-${Date.now()}`;
    const loadingText = "Analyzing logic flow... 🧠";

    setMessages(prev => [...prev, { 
      _id: aiMsgId, 
      senderId: "AI_BOT", 
      content: loadingText, 
      createdAt: new Date().toISOString() 
    }]);
    setDecryptedMessages(prev => ({ ...prev, [aiMsgId]: loadingText }));

    const res = await fetch("/api/ai/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        code: cleanCode, 
        mode: "DESCRIBE" 
      }),
    });
    
    const data = await res.json();
    
    setMessages(prev => prev.filter(m => m._id !== aiMsgId));

    if (data.suggestion) {
      await sendMessage(`### 🧠 LOGIC_EXPLAINED\n\n${data.suggestion}`);
    }

  } catch (err) {
    console.error("AI Description failed", err);
  }
};

const requestAIReview = async (msgId: string, rawCode: string) => {
  try {
    const aiMsgId = `ai-${Date.now()}`;
    const loadingMsg = { 
      _id: aiMsgId, 
      senderId: "AI_BOT", 
      content: "Analyzing code... please wait.", 
      createdAt: new Date().toISOString() 
    };
    setMessages(prev => [...prev, loadingMsg]);
    setDecryptedMessages(prev => ({ ...prev, [aiMsgId]: "System: Analyzing code structure..." }));

    const res = await fetch("/api/ai/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: rawCode }),
    });
    
    const data = await res.json();

    await sendMessage(`[AI CODE REVIEW]\n\n${data.suggestion}`);

  } catch (err) {
    console.error("AI Review Trigger failed", err);
  }
};

 // ← UPDATED: stopRecording now returns a Blob, we upload it to UploadThing
 const handleVoiceSend = async () => {
  const audioBlob = await stopRecording();
  if (!audioBlob) return;

  try {
    const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
    const uploaded = await uploadVoice([file]);

    if (uploaded?.[0]?.url) {
      // URL is sent just like before — E2EE encrypts it transparently
      await sendMessage(`AUDIO_PACKET:${uploaded[0].url}`);
    } else {
      console.error("Voice upload failed: no URL returned");
    }
  } catch (err) {
    console.error("Voice upload error:", err);
  }
};

  const scrollToBottom = useCallback(() => {
    if (!isGrepActive) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isGrepActive]);

  useEffect(() => { scrollToBottom(); }, [messages, isPeerTyping, decryptedMessages, scrollToBottom]);

  useEffect(() => {
    const loadChat = async () => {
      if (!userId || !peerId) return;
      try {
        const res = await fetch(`/api/messages?user1=${userId}&user2=${peerId}`);
        const data = await res.json();
        setMessages(data);
        socketRef.current?.emit("seen-messages", { senderId: peerId, receiverId: userId });

        const userRes = await fetch(`/api/users/${peerId}`);
        const userData = await userRes.json();
        setPeerName(userData.username);
        setPeerAvatar(userData.avatar);
        setPeerPublicKey(userData.publicKey);
      } catch (err) {
        console.error("Failed to load chat data", err);
      }
    };
    loadChat();
  }, [userId, peerId, socketRef]);

 useEffect(() => {
    const decryptAll = async () => {
      const privKeyRaw = localStorage.getItem(`privKey_${userId}`);
      if (!privKeyRaw || messages.length === 0) return;

      try {
        const privKey = await importPrivateKey(privKeyRaw);
        const newDecrypted = { ...decryptedMessages };
        let updated = false;

        for (const m of messages) {
          const msgId = m._id || m.createdAt;
          if (newDecrypted[msgId]) continue;

          try {
            const isMe = m.senderId === userId;
            const rawData = isMe ? m.contentSender : m.content;

    if (m.senderId === "AI_BOT") {
      newDecrypted[msgId] = m.content;
      updated = true;
      continue;
    }

            if (!rawData) {
              if (new Date().getTime() - new Date(m.createdAt).getTime() < 2000) continue; 
              newDecrypted[msgId] = isMe ? "[History Unavailable]" : "[Encrypted Packet]";
              updated = true;
              continue;
            }

            const { ct, iv, wk } = JSON.parse(rawData);

            const wrappedKeyBuffer = Uint8Array.from(atob(wk), (c) => c.charCodeAt(0));
            const aesKeyBuffer = await window.crypto.subtle.decrypt(
              { name: "RSA-OAEP" }, 
              privKey, 
              wrappedKeyBuffer
            );

            const aesKey = await window.crypto.subtle.importKey(
              "raw", 
              aesKeyBuffer, 
              { name: "AES-GCM" }, 
              true, 
              ["decrypt"]
            );

            const contentBuffer = Uint8Array.from(atob(ct), (c) => c.charCodeAt(0));
            const ivBuffer = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
            
            const decryptedBuffer = await window.crypto.subtle.decrypt(
              { name: "AES-GCM", iv: ivBuffer },
              aesKey,
              contentBuffer
            );

            newDecrypted[msgId] = new TextDecoder().decode(decryptedBuffer);
            updated = true;

          } catch (e) {
            console.error("Decryption error for message:", msgId, e);
            newDecrypted[msgId] = "[ERROR: DECRYPTION_FAILED]";
            updated = true;
          }
        }
        if (updated) setDecryptedMessages(newDecrypted);
      } catch (err) {
        console.error("Hybrid Decryption setup failed", err);
      }
    };
    decryptAll();
  }, [messages, userId]);

  // Socket Listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (msg: any) => {
      const isRelevant = (msg.senderId === userId && msg.receiverId === peerId) || 
                         (msg.senderId === peerId && msg.receiverId === userId);
      if (isRelevant) {
        if (msg.senderId === userId) return; 
        const formattedMsg = { ...msg, content: msg.content || msg.message, _id: msg._id || `temp-${Date.now()}` };
        setMessages((prev) => [...prev, formattedMsg]);
        if (msg.senderId === peerId) socket.emit("seen-messages", { senderId: peerId, receiverId: userId });
      }
    };

    const handleSeen = ({ seenBy }: { seenBy: string }) => {
      if (seenBy === peerId) setMessages((prev) => prev.map(m => m.senderId === userId ? { ...m, seen: true } : m));
    };

    const handleTyping = ({ from, isTyping }: { from: string, isTyping: boolean }) => {
      if (from === peerId) setIsPeerTyping(isTyping);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setText(e.target.value);
    socketRef.current?.emit("typing", { to: peerId, from: userId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing", { to: peerId, from: userId, isTyping: false });
    }, 2000);
  };

const sendMessage = async (overrideContent?: string) => {
  const contentToSend = overrideContent || text;
  if (!contentToSend.trim() || !peerPublicKey) return;

  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  socketRef.current?.emit("typing", { to: peerId, from: userId, isTyping: false });

  try {
    const rawText = contentToSend;
    if (!overrideContent) setText(""); 

    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(rawText);
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encodedText
    );

    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const peerPub = await importPublicKey(peerPublicKey);
    
    const meRes = await fetch(`/api/users/${userId}`);
    const meData = await meRes.json();
    const myPub = await importPublicKey(meData.publicKey);

    const wrappedKeyPeer = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, peerPub, exportedAesKey);
    const wrappedKeyMe = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, myPub, exportedAesKey);

    const packagePeer = JSON.stringify({
      ct: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
      iv: btoa(String.fromCharCode(...iv)),
      wk: btoa(String.fromCharCode(...new Uint8Array(wrappedKeyPeer)))
    });

    const packageMe = JSON.stringify({
      ct: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
      iv: btoa(String.fromCharCode(...iv)),
      wk: btoa(String.fromCharCode(...new Uint8Array(wrappedKeyMe)))
    });

    const tempId = `msg-${Date.now()}`;
    const tempMsg = { 
      _id: tempId, 
      senderId: userId, 
      receiverId: peerId, 
      content: packagePeer, 
      contentSender: packageMe, 
      createdAt: new Date().toISOString() 
    };
    
    setMessages((prev) => [...prev, tempMsg]);
    setDecryptedMessages(prev => ({ ...prev, [tempId]: rawText }));

    socketRef.current?.emit("send-message", { to: peerId, message: packagePeer, senderId: userId });
    
    const dbRes = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        senderId: userId, 
        receiverId: peerId, 
        content: packagePeer, 
        contentSender: packageMe 
      }),
    });

    if (!dbRes.ok) throw new Error("Database failed to save");

  } catch (err) {
    console.error("Hybrid Transmission failed", err);
  }
};

  // --- SEARCH LOGIC ---
  const displayedMessages = isGrepActive 
    ? messages.filter(m => (decryptedMessages[m._id || m.createdAt] || "").toLowerCase().includes(grepQuery.toLowerCase()))
    : messages;

  const onEmojiClick = (emojiData: any) => {
    setText((prev) => prev + emojiData.emoji);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#090b0f", border: "2px solid #30363D", borderRadius: "8px", margin: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", fontFamily: "'Fira Code', monospace", overflow: "hidden" }}>
      <style>{`
        .terminal-scroll::-webkit-scrollbar { width: 8px; }
        .terminal-scroll::-webkit-scrollbar-track { background: #0D1117; }
        .terminal-scroll::-webkit-scrollbar-thumb { background: #30363D; border-radius: 4px; }
        .fade-in { animation: fadeIn 0.2s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rec-glow {
  0% { box-shadow: 0 0 0px #ff333300; }
  50% { box-shadow: 0 0 16px #ff333366; }
  100% { box-shadow: 0 0 0px #ff333300; }
}

.rec-pulse {
  animation: rec-glow 1.5s infinite ease-in-out;
}
      `}</style>

      {/* Header */}
      <div style={{ background: "#161B22", padding: "12px 16px", borderBottom: "2px solid #30363D", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "4px", border: "1px solid #30363D", background: "#0D1117", overflow: "hidden" }}>
            {peerAvatar && <img src={peerAvatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="avatar" />}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: "bold", color: "#C9D1D9", fontSize: "14px" }}>
              {peerName?.toLowerCase() || "user"} <span style={{ color: "#7EE787", fontSize: "10px" }}>[SECURE]</span>
            </span>
            {isPeerTyping && <span style={{ fontSize: "10px", color: "#7EE787" }}>// typing...</span>}
          </div>
        </div>
        
        <button 
          onClick={() => { setIsGrepActive(!isGrepActive); setGrepQuery(""); }} 
          style={{ background: "transparent", border: "none", color: isGrepActive ? "#7EE787" : "#8B949E", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
        >
          {isGrepActive ? (
            <span style={{ fontSize: "12px", border: "1px solid #30363D", padding: "2px 6px", borderRadius: "4px" }}>ESC</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          )}
        </button>
      </div>

      {/* Search Bar - Conditional */}
      {isGrepActive && (
        <div className="fade-in" style={{ background: "#0D1117", padding: "8px 16px", borderBottom: "1px solid #30363D", display: "flex", alignItems: "center" }}>
          <span style={{ color: "#7EE787", marginRight: "10px", fontSize: "12px" }}>grep:</span>
          <input 
            autoFocus
            style={{ flex: 1, background: "transparent", border: "none", color: "#C9D1D9", outline: "none", fontSize: "14px" }}
            placeholder="search chat history..."
            value={grepQuery}
            onChange={(e) => setGrepQuery(e.target.value)}
          />
        </div>
      )}

      {/* Messages Area */}
      <div className="terminal-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {displayedMessages.length === 0 && isGrepActive && (
          <div style={{ color: "#484F58", textAlign: "center", marginTop: "20px", fontSize: "12px" }}>
            -- NO MATCHES FOUND FOR: {grepQuery} --
          </div>
        )}

{displayedMessages.map((m) => {
  const isMe = m.senderId === userId;
  const msgId = m._id || m.createdAt;
  const displayContent = decryptedMessages[msgId] || "Decrypting packet...";
  
  const isAI = m.senderId === "AI_BOT" || displayContent.startsWith("### 🧠 LOGIC_EXPLAINED");

  return (
    <div key={msgId} style={{ 
      alignSelf: isAI ? "center" : (isMe ? "flex-end" : "flex-start"),
      width: isAI ? "95%" : "auto", 
      maxWidth: "85%", 
      borderRadius: "4px", 
      padding: "12px 16px",
      border: isAI ? "1px double #58A6FF" : (isMe ? "1px solid #238636" : "1px solid #30363D"),
      background: isAI ? "#0d1117" : (isMe ? "#23863622" : "#161B22"),
      color: isAI ? "#C9D1D9" : (isMe ? "#7EE787" : "#C9D1D9"),
      boxShadow: isAI ? "0 0 15px rgba(58, 166, 255, 0.05)" : "none",
      position: "relative"
    }}>
      {isAI && (
        <div style={{ fontSize: '9px', color: '#58A6FF', marginBottom: '8px', borderBottom: '1px solid #58A6FF33', paddingBottom: '4px' }}>
          [SYSTEM_DIAGNOSTIC_REPORT] // SOURCE: NEURAL_ENGINE
        </div>
      )}

      <div style={{ fontSize: "14px" }}>
        <span style={{ color: isAI ? "#58A6FF" : (isMe ? "#7EE787" : "#58A6FF"), marginRight: "8px" }}>
          {isAI ? "⚡" : (isMe ? ">" : "$")}
        </span>
        
       {isAI ? (
  <div style={{ lineHeight: "1.6", color: "#C9D1D9" }}>
    <div style={{ 
       whiteSpace: "pre-wrap",
       wordBreak: "break-word",
       fontFamily: "'Fira Code', monospace", 
       fontSize: '13px',
       color: '#ADC6FF' 
    }}>
      {displayContent.replace("### 🧠 LOGIC_EXPLAINED", "").trim()}
    </div>
  </div>
) : (
  <CodeReviewer text={displayContent} />
)}
      </div>
      
  
      {displayContent.includes("```") && (
  <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
    <button 
      onClick={() => requestAIReview(msgId, displayContent)}
      style={{
        fontSize: "9px",
        color: isMe ? "#58A6FF" : "#7EE787", 
        background: "rgba(35, 134, 54, 0.1)",
        border: `1px solid ${isMe ? "#58A6FF" : "#238636"}`,
        borderRadius: "3px",
        padding: "3px 8px",
        cursor: "pointer",
        textTransform: "uppercase"
      }}
    >
      {isMe ? "DEBUG_MY_CODE" : "RUN_AI_REVIEW"}
    </button>

    <button 
      onClick={() => requestAIDescription(msgId, displayContent)}
      style={{
        fontSize: "9px",
        color: "#58A6FF", 
        background: "rgba(88, 166, 255, 0.1)",
        border: "1px solid #58A6FF",
        borderRadius: "3px",
        padding: "3px 8px",
        cursor: "pointer",
        textTransform: "uppercase"
      }}
    >
      EXPLAIN_LOGIC
    </button>

    {!isMe && (
      <button 
        onClick={() => {
          const cleanCode = displayContent.replace(/###SENIOR_REVIEW\n\n/g, "");
          setReviewData({ id: msgId, code: cleanCode, comments: "" });
          setIsReviewMode(true);
        }}
        style={{
          fontSize: "9px",
          color: "#f1e05a", 
          background: "rgba(241, 224, 90, 0.1)",
          border: "1px solid #f1e05a",
          borderRadius: "3px",
          padding: "3px 8px",
          cursor: "pointer",
          textTransform: "uppercase"
        }}
      >
        OPEN_IN_EDITOR
      </button>
    )}
  </div>
)}

      <div style={{ fontSize: "10px", marginTop: "6px", opacity: 0.5, textAlign: "right" }}>
        {new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
        {isMe && (m.seen ? " [READ]" : " [SENT]")}
      </div>
    </div>
  );
})}
        <div ref={messagesEndRef} />
      </div>

{isReviewMode && (
  <div style={{ 
    margin: "0 16px",
    background: "#161B22", 
    border: "1px solid #f1e05a", 
    borderRadius: "8px 8px 0 0",
    padding: "12px",
    boxShadow: "0 -5px 20px rgba(0,0,0,0.5)",
    zIndex: 10
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
      <span style={{ color: "#f1e05a", fontSize: "11px", fontWeight: "bold" }}>
        [EDITOR] // EDITING_REMOTE_SOURCE
      </span>
      <button 
        onClick={() => setIsReviewMode(false)}
        style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", fontSize: "12px" }}
      >
        ✕ CANCEL
      </button>
    </div>

    <div style={{ marginBottom: "10px" }}>
      <div style={{ color: "#8B949E", fontSize: "10px", marginBottom: "4px" }}>// SOURCE_CODE</div>
      <textarea 
        style={{
          width: "100%",
          background: "#0D1117",
          color: "#7EE787",
          border: "1px solid #30363D",
          borderRadius: "4px",
          padding: "10px",
          fontSize: "13px",
          fontFamily: "'Fira Code', monospace",
          resize: "vertical",
          minHeight: "120px"
        }}
        value={reviewData.code}
        onChange={(e) => setReviewData({ ...reviewData, code: e.target.value })}
        spellCheck={false}
      />
    </div>

    <div>
      <div style={{ color: "#8B949E", fontSize: "10px", marginBottom: "4px" }}>// MENTOR_NOTES</div>
      <textarea 
        placeholder="Explain why you changed the code..."
        style={{
          width: "100%",
          background: "#0D1117",
          color: "#C9D1D9",
          border: "1px solid #30363D",
          borderRadius: "4px",
          padding: "10px",
          fontSize: "13px",
          fontFamily: "'Fira Code', monospace",
          resize: "none",
          minHeight: "60px"
        }}
        value={reviewData.comments}
        onChange={(e) => setReviewData({ ...reviewData, comments: e.target.value })}
      />
    </div>

    <button 
      onClick={async () => {
        const finalCode = reviewData.code.includes("```") 
          ? reviewData.code 
          : `\`\`\`\n${reviewData.code}\n\`\`\``;

        const fullReview = reviewData.comments.trim() 
          ? `### SENIOR_PATCH\n\n${finalCode}\n\n---\n**NOTES:** ${reviewData.comments}`
          : `### SENIOR_PATCH\n\n${finalCode}`;

        await sendMessage(fullReview);
        setIsReviewMode(false);
      }}
      style={{
        width: "100%",
        marginTop: "12px",
        background: "#f1e05a22",
        color: "#f1e05a",
        border: "1px solid #f1e05a",
        padding: "8px",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: "bold"
      }}
    >
      COMMIT_PATCH_TO_CHAT
    </button>
  </div>
)}

      {/* Input Section */}
      <div style={{ padding: "16px", borderTop: "2px solid #30363D", background: "#161B22" }}>
        {text.includes("```") && (
          <div style={{ 
            padding: "10px", 
            background: "#0D1117", 
            border: "1px dashed #238636", 
            borderBottom: "none",
            borderRadius: "6px 6px 0 0",
            fontSize: "12px",
            margin: "0 16px -1px 16px" 
          }}>
            <div style={{ color: "#238636", fontSize: "10px", marginBottom: "8px" }}>// PREVIEW_MODE: DETECTED_CODE_BLOCK</div>
            <CodeReviewer text={text} />
          </div>
        )}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", background: "#0D1117", border: "1px solid #30363D", borderRadius: "6px", padding: "4px 8px" }}>
          <span style={{ color: "#7EE787", fontWeight: "bold", fontSize: "14px", marginLeft: "4px", userSelect: "none" }}>$</span>

          <textarea 
            rows={text.split('\n').length > 3 ? 3 : 1} 
            style={{ 
              flex: 1, 
              padding: "10px 4px", 
              border: "none", 
              background: "transparent", 
              color: "#C9D1D9", 
              outline: "none",
              fontFamily: "'Fira Code', monospace",
              fontSize: "14px",
              resize: "none", 
              overflowY: "auto"
            }} 
            value={text} 
            onChange={handleInputChange} 
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); 
                sendMessage();
              }
            }} 
            placeholder="type_message_here..." 
          />

          {showEmojiPicker && (
            <div style={{ position: "absolute", bottom: "100%", right: "0", marginBottom: "12px", zIndex: 1000, boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
              <EmojiPicker 
                theme={Theme.DARK} 
                onEmojiClick={onEmojiClick}
                skinTonesDisabled
                searchPlaceholder="grep emoji..."
                width={300}
                height={400}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>

            <button 
  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
  style={{ 
    background: showEmojiPicker ? "rgba(202, 172, 3, 0.1)" : "transparent", 
    border: showEmojiPicker ? "1px solid #caac03" : "1px solid transparent", 
    color: "#caac03", 
    cursor: "pointer",
    borderRadius: "4px",
    padding: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease-in-out",
    outline: "none",
    boxShadow: showEmojiPicker ? "0 0 10px rgba(202, 172, 3, 0.2)" : "none"
  }}
  onMouseEnter={(e) => { if(!showEmojiPicker) e.currentTarget.style.background = "#30363D" }}
  onMouseLeave={(e) => { if(!showEmojiPicker) e.currentTarget.style.background = "transparent" }}
  title="INSERT_GLYPH_PROTOCOL"
>
  {showEmojiPicker ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
      <line x1="9" y1="9" x2="9.01" y2="9"></line>
      <line x1="15" y1="9" x2="15.01" y2="9"></line>
    </svg>
  )}
</button>

            {/* ← UPDATED: mic button shows uploading state too */}
            <button 
  onMouseDown={startRecording} 
  onMouseUp={handleVoiceSend}
  disabled={isUploadingVoice}
  className={isRecording ? "rec-pulse" : ""}
  style={{
    background: isRecording ? "#ff333322" : isUploadingVoice ? "#58A6FF22" : "transparent",
    border: isRecording ? "1px solid #ff3333" : isUploadingVoice ? "1px solid #58A6FF" : "1px solid #30363D",
    color: isRecording ? "#ff3333" : isUploadingVoice ? "#58A6FF" : "#8B949E",
    borderRadius: "4px",
    padding: "8px 10px",
    cursor: isUploadingVoice ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    outline: "none"
  }}
  title={isRecording ? "RECORDING_STREAM..." : isUploadingVoice ? "UPLOADING..." : "START_VOICE_CAPTURE"}
>
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
  
  {isRecording && (
    <span style={{ fontSize: "9px", marginLeft: "6px", fontWeight: "bold" }}>REC</span>
  )}
  {isUploadingVoice && (
    <span style={{ fontSize: "9px", marginLeft: "6px", fontWeight: "bold" }}>UP...</span>
  )}
</button>

            <button 
              onClick={() => sendMessage()}
              style={{ 
                background: "#23863622", 
                color: "#7EE787", 
                border: "1px solid #238636", 
                borderRadius: "4px", 
                padding: "6px 16px", 
                cursor: "pointer",
                fontFamily: "'Fira Code', monospace",
                fontSize: "12px",
                fontWeight: "bold",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#23863644")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#23863622")}
            >
              SEND
            </button>
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", padding: "0 4px" }}>
          <span style={{ fontSize: "10px", color: "#484F58" }}>// tunnel_status: ACTIVE</span>
          <span style={{ fontSize: "10px", color: "#484F58" }}>chars: {text.length}</span>
        </div>
      </div>
    </div>
  );
}