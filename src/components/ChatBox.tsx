"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import CodeReviewer from "./CodeReviewer";
import { useAudioRecorder } from "@/hooks/useAudioRecorder"; 



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
  // const [reviewingCode, setReviewingCode] = useState<{id: string, code: string} | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
const [reviewData, setReviewData] = useState({ id: "", code: "", comments: "" });

const requestAIDescription = async (msgId: string, rawCode: string) => {
  try {
    // 1. Clean the code: Remove any existing AI headers if they exist
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

    // Show loading locally in the UI
    setMessages(prev => [...prev, { 
      _id: aiMsgId, 
      senderId: "AI_BOT", 
      content: loadingText, 
      createdAt: new Date().toISOString() 
    }]);
    setDecryptedMessages(prev => ({ ...prev, [aiMsgId]: loadingText }));

    // 2. The Fetch Call
    const res = await fetch("/api/ai/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        code: cleanCode, // Explicitly sending the cleaned code
        mode: "DESCRIBE" 
      }),
    });
    
    const data = await res.json();
    
    // 3. Remove the loading message before sending the real one
    setMessages(prev => prev.filter(m => m._id !== aiMsgId));

    if (data.suggestion) {
      // Use sendMessage to encrypt and persist the AI's explanation
      await sendMessage(`### 🧠 LOGIC_EXPLAINED\n\n${data.suggestion}`);
    }

  } catch (err) {
    console.error("AI Description failed", err);
  }
};

const requestAIReview = async (msgId: string, rawCode: string) => {
  try {
    // 1. Show a loading state locally
    const aiMsgId = `ai-${Date.now()}`;
    const loadingMsg = { 
      _id: aiMsgId, 
      senderId: "AI_BOT", 
      content: "Analyzing code... please wait.", 
      createdAt: new Date().toISOString() 
    };
    setMessages(prev => [...prev, loadingMsg]);
    setDecryptedMessages(prev => ({ ...prev, [aiMsgId]: "System: Analyzing code structure..." }));
    

    // 2. Call our Groq Route
    const res = await fetch("/api/ai/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: rawCode }),
    });
    
    const data = await res.json();

    // 3. Encrypt and Save the AI response to DB so it persists
    // Note: Use your existing 'sendMessage' logic here, 
    // but set the senderId to 'AI_BOT' or a specific ID.
    await sendMessage(`[AI CODE REVIEW]\n\n${data.suggestion}`);

  } catch (err) {
    console.error("AI Review Trigger failed", err);
  }
};

 const handleVoiceSend = async () => {
  const base64Audio = await stopRecording();
  if (base64Audio) {
    // This now triggers the FULL encryption + DB save process
    await sendMessage(`AUDIO_PACKET:${base64Audio}`);
  }
};

  const scrollToBottom = useCallback(() => {
    if (!isGrepActive) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isGrepActive]);

  useEffect(() => { scrollToBottom(); }, [messages, isPeerTyping, decryptedMessages, scrollToBottom]);

  // Load Chat & Peer Info
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

  // Handle Decryption Loop
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

            // --- ADD THIS CHECK HERE ---
    // Skip if it's an AI_BOT system message (already plaintext)
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

            // --- HYBRID DECRYPTION LOGIC ---
            // 1. Parse the JSON package
            const { ct, iv, wk } = JSON.parse(rawData);

            // 2. Decrypt the AES key (wk) using RSA Private Key
            const wrappedKeyBuffer = Uint8Array.from(atob(wk), (c) => c.charCodeAt(0));
            const aesKeyBuffer = await window.crypto.subtle.decrypt(
              { name: "RSA-OAEP" }, 
              privKey, 
              wrappedKeyBuffer
            );

            // 3. Import the decrypted AES key
            const aesKey = await window.crypto.subtle.importKey(
              "raw", 
              aesKeyBuffer, 
              { name: "AES-GCM" }, 
              true, 
              ["decrypt"]
            );

            // 4. Decrypt the actual content (ct) using AES-GCM
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
            // Fallback: If JSON.parse fails, it might be an old RSA-only message
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

  // FIXED: Changed type to support TextArea
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
    if (!overrideContent) setText(""); // Clear input only if it was a text message

    // 1. Generate AES-GCM key
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // 2. Encrypt
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(rawText);
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encodedText
    );

    // 3. Export & Wrap keys
    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const peerPub = await importPublicKey(peerPublicKey);
    
    // Fetch my key for history decryption
    const meRes = await fetch(`/api/users/${userId}`);
    const meData = await meRes.json();
    const myPub = await importPublicKey(meData.publicKey);

    const wrappedKeyPeer = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, peerPub, exportedAesKey);
    const wrappedKeyMe = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, myPub, exportedAesKey);

    // 4. Package
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

    // 5. Update UI Locally
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

    // 6. SOCKET EMIT
    socketRef.current?.emit("send-message", { to: peerId, message: packagePeer, senderId: userId });
    
    // 7. PERSIST TO MONGO (The part that was missing for audio)
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0D1117", border: "2px solid #30363D", borderRadius: "8px", margin: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", fontFamily: "'Fira Code', monospace", overflow: "hidden" }}>
      <style>{`
        .terminal-scroll::-webkit-scrollbar { width: 8px; }
        .terminal-scroll::-webkit-scrollbar-track { background: #0D1117; }
        .terminal-scroll::-webkit-scrollbar-thumb { background: #30363D; border-radius: 4px; }
        .fade-in { animation: fadeIn 0.2s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
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
  
  // NEW: Identify if this is an AI system report
  const isAI = m.senderId === "AI_BOT" || displayContent.startsWith("### 🧠 LOGIC_EXPLAINED");

  return (
    <div key={msgId} style={{ 
      // AI reports sit in the center, User/Peer sit on sides
      alignSelf: isAI ? "center" : (isMe ? "flex-end" : "flex-start"),
      width: isAI ? "95%" : "auto", 
      maxWidth: "85%", 
      borderRadius: "4px", 
      padding: "12px 16px",
      // Distinct border for AI (double line or blue glow)
      border: isAI ? "1px double #58A6FF" : (isMe ? "1px solid #238636" : "1px solid #30363D"),
      // Darker background for AI to make it look like a system log
      background: isAI ? "#0d1117" : (isMe ? "#23863622" : "#161B22"),
      color: isAI ? "#C9D1D9" : (isMe ? "#7EE787" : "#C9D1D9"),
      boxShadow: isAI ? "0 0 15px rgba(58, 166, 255, 0.05)" : "none",
      position: "relative"
    }}>
      {/* ADD A SYSTEM TAG FOR AI */}
      {isAI && (
        <div style={{ fontSize: '9px', color: '#58A6FF', marginBottom: '8px', borderBottom: '1px solid #58A6FF33', paddingBottom: '4px' }}>
          [SYSTEM_DIAGNOSTIC_REPORT] // SOURCE: NEURAL_ENGINE
        </div>
      )}

      <div style={{ fontSize: "14px" }}>
        <span style={{ color: isAI ? "#58A6FF" : (isMe ? "#7EE787" : "#58A6FF"), marginRight: "8px" }}>
          {isAI ? "⚡" : (isMe ? ">" : "$")}
        </span>
        
        {/* Render Logic */}
       {isAI ? (
  <div style={{ lineHeight: "1.6", color: "#C9D1D9" }}>
    <div style={{ 
       whiteSpace: "pre-wrap", // Essential for wrapping
       wordBreak: "break-word",
       fontFamily: "'Fira Code', monospace", 
       fontSize: '13px',
       color: '#ADC6FF' 
    }}>
      {/* Remove the redundant <pre> and just use a div with whiteSpace */}
      {displayContent.replace("### 🧠 LOGIC_EXPLAINED", "").trim()}
    </div>
  </div>
) : (
  <CodeReviewer text={displayContent} />
)}
      </div>
      

  
      {/* --- ACTION BUTTONS --- */}
{displayContent.includes("```") && (
  <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
    {/* AI REVIEW */}
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

    {/* AI EXPLAIN */}
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

    {/* MANUAL EDITOR */}
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

    {/* EDITABLE CODE BLOCK */}
    <div style={{ marginBottom: "10px" }}>
      <div style={{ color: "#8B949E", fontSize: "10px", marginBottom: "4px" }}>// SOURCE_CODE</div>
      <textarea 
        style={{
          width: "100%",
          background: "#0D1117",
          color: "#7EE787", // Greenish code color
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

    {/* MENTOR COMMENTS */}
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
        // Automatically wrap edited code in backticks if the user forgot them
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
                sendMessage(); // Fixed: sendMessage is called without returning its promise result
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
                background: showEmojiPicker ? "#30363D" : "transparent", 
                border: "none", 
                color: "#caac03", 
                cursor: "pointer",
                borderRadius: "4px",
                padding: "6px",
                display: "flex",
                alignItems: "center",
                transition: "all 0.2s"
              }}
              title="insert_glyph"
            >
              <span style={{ 
                fontSize: "22px", 
                filter: showEmojiPicker ? "drop-shadow(0 0 5px rgba(221, 245, 5, 0.4))" : "none" 
              }}>
                {showEmojiPicker ? "✕" : "☺"}
              </span>
            </button>

            <button 
    onMouseDown={startRecording} 
    onMouseUp={handleVoiceSend}
    style={{
      background: isRecording ? "#ff333322" : "transparent",
      border: isRecording ? "1px solid #ff3333" : "1px solid #30363D",
      color: isRecording ? "#ff3333" : "#8B949E",
      borderRadius: "4px",
      padding: "6px 10px",
      cursor: "pointer",
      transition: "all 0.2s"
    }}
  >
    {isRecording ? "REC..." : "🎤"}
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