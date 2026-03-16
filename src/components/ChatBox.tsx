"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";
import EmojiPicker, { Theme } from "emoji-picker-react";
import CodeReviewer from "./CodeReviewer";
import VoiceMessage from "./VoiceMessage";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import MatrixRain from "./chatBackgrounds/MatrixRain";
import ParticlesBg from "./chatBackgrounds/Particlesbg";
import NeuralBg from "./chatBackgrounds/NeuralBg";
import AskAIModal from "./AskAIModal";
import FreeAIChat from "./FreeAIChat";
import AIMessage from "./AiMessage";

// --- E2EE CRYPTO HELPERS ---
async function importPublicKey(pem: string) {
  const binaryDer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}
async function importPrivateKey(pem: string) {
  const binaryDer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey("pkcs8", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}

function TickIcon({ status }: { status: "sending" | "sent" | "delivered" | "seen" }) {
  if (status === "sending") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#484F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></svg>;
  if (status === "sent") return <svg width="14" height="10" viewBox="0 0 16 10" fill="none"><polyline points="1,5 5,9 14,1" stroke="#484F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (status === "delivered") return <svg width="18" height="10" viewBox="0 0 20 10" fill="none"><polyline points="1,5 5,9 14,1" stroke="#484F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polyline points="6,5 10,9 19,1" stroke="#484F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg width="18" height="10" viewBox="0 0 20 10" fill="none"><polyline points="1,5 5,9 14,1" stroke="#58A6FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polyline points="6,5 10,9 19,1" stroke="#58A6FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function getMessageStatus(m: any): "sending" | "sent" | "delivered" | "seen" {
  if (m.seen) return "seen";
  if (m.delivered) return "delivered";
  if (m._id?.startsWith("msg-")) return "sending";
  return "sent";
}

function FileMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const packetLine = lines[0];
  const caption = lines.slice(1).join("\n").trim();
  const raw = packetLine.replace("FILE_PACKET:", "");
  const parts = raw.split("|");
  const url = parts[0] ?? "";
  const name = parts[1] ?? "file";
  const type = parts[2] ?? "";

  if (type.startsWith("image/")) {
    return (
      <div>
        <img src={url} alt={name} onClick={() => window.open(url, "_blank")}
          className="rounded border border-[#30363D] cursor-pointer block object-cover"
          style={{ width: "240px", height: "auto", maxWidth: "100%" }} />
        <span className="text-[10px] text-[#484F58] mt-1 block">{name}</span>
        {caption && <span className="text-[13px] text-[#C9D1D9] mt-1 block">{caption}</span>}
      </div>
    );
  }

  return (
    <div style={{ width: "240px" }}>
      <div className="px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded">
        <span className="text-[#58A6FF] text-xs">{type === "application/pdf" ? "[PDF] " : "[FILE] "}</span>
        <span className="text-[#58A6FF] text-xs cursor-pointer underline" onClick={() => window.open(url, "_blank")}>{name}</span>
      </div>
      {caption && <div className="text-[13px] text-[#C9D1D9] mt-1">{caption}</div>}
    </div>
  );
}

export default function ChatBox({ userId, peerId, onBack }: { userId: string; peerId: string; onBack?: () => void }) {
    const socketRef = useSocket(userId);
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [bgStyle, setBgStyle] = useState<"matrix" | "particles" | "neural" | "none">("matrix");
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [peerName, setPeerName] = useState("");
  const [peerAvatar, setPeerAvatar] = useState("");
  const [peerPublicKey, setPeerPublicKey] = useState<string | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, string>>({});
  const [grepQuery, setGrepQuery] = useState("");
  const [isGrepActive, setIsGrepActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewData, setReviewData] = useState({ id: "", code: "", comments: "" });
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);
  const [dragPreviewUrl, setDragPreviewUrl] = useState<string | null>(null);
  const [dragCaption, setDragCaption] = useState("");
  const [aiContextMenu, setAiContextMenu] = useState<{ x: number; y: number; msgId: string; content: string } | null>(null);
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function ReplyMessage({ content }: { content: string }) {
    const raw = content.replace("REPLY_PACKET:", "");
    const separatorIndex = raw.lastIndexOf("|");
    const quoted = raw.substring(0, separatorIndex);
    const actual = raw.substring(separatorIndex + 1);
    return (
      <div>
        <div className="border-l-2 border-[#58A6FF] pl-2 mb-1.5 opacity-60 text-xs text-[#8B949E] truncate max-w-full">
          {quoted.startsWith("FILE_PACKET:") ? "[file]" : quoted.startsWith("AUDIO_PACKET:") ? "[voice message]" : quoted.split("\n")[0].substring(0, 60)}
        </div>
        {actual.startsWith("FILE_PACKET:") ? <FileMessage content={actual} /> : <CodeReviewer text={actual} />}
      </div>
    );
  }

  const handleFileSend = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert("FILE_TOO_LARGE: Max size is 15MB"); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    setIsUploadingFile(true); setUploadProgress(0);
    try {
      const formData = new FormData(); formData.append("file", file);
      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = async () => { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300 && data.url) await sendMessage(`FILE_PACKET:${data.url}|${file.name}|${file.type}`); resolve(); };
        xhr.onerror = () => resolve(); xhr.open("POST", "/api/upload-file"); xhr.send(formData);
      });
    } catch (err) { console.error("File upload error:", err); }
    finally { setIsUploadingFile(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert("FILE_TOO_LARGE: Max size is 15MB"); return; }
    setDraggedFile(file);
    if (file.type.startsWith("image/")) setDragPreviewUrl(URL.createObjectURL(file)); else setDragPreviewUrl(null);
  };

  const handleDragPreviewSend = async () => {
    if (!draggedFile) return;
    setIsUploadingFile(true); setUploadProgress(0); setDraggedFile(null); setDragPreviewUrl(null);
    try {
      const formData = new FormData(); formData.append("file", draggedFile);
      const caption = dragCaption.trim(); setDragCaption("");
      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = async () => { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300 && data.url) { const p = `FILE_PACKET:${data.url}|${draggedFile.name}|${draggedFile.type}`; await sendMessage(caption ? `${p}\n${caption}` : p); } resolve(); };
        xhr.onerror = () => resolve(); xhr.open("POST", "/api/upload-file"); xhr.send(formData);
      });
    } catch (err) { console.error("Drag upload error:", err); }
    finally { setIsUploadingFile(false); setUploadProgress(0); }
  };

  const requestAIDescription = async (msgId: string, rawCode: string) => {
    try {
      const cleanCode = rawCode.replace(/### 🧠 LOGIC_EXPLAINED/g, "").replace(/\[SYSTEM_DIAGNOSTIC_REPORT\].*/g, "").trim();
      if (!cleanCode || cleanCode.includes("Analyzing logic flow")) return;
      const aiMsgId = `ai-desc-${Date.now()}`; const loadingText = "Analyzing logic flow... 🧠";
      setMessages(prev => [...prev, { _id: aiMsgId, senderId: "AI_BOT", content: loadingText, createdAt: new Date().toISOString() }]);
      setDecryptedMessages(prev => ({ ...prev, [aiMsgId]: loadingText }));
      const res = await fetch("/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: cleanCode, mode: "DESCRIBE" }) });
      const data = await res.json();
      setMessages(prev => prev.filter(m => m._id !== aiMsgId));
      if (data.suggestion) await sendMessage(`### 🧠 LOGIC_EXPLAINED\n\n${data.suggestion}`);
    } catch (err) { console.error("AI Description failed", err); }
  };

  const requestAIReview = async (msgId: string, rawCode: string) => {
    try {
      const aiMsgId = `ai-${Date.now()}`;
      setMessages(prev => [...prev, { _id: aiMsgId, senderId: "AI_BOT", content: "Analyzing code...", createdAt: new Date().toISOString() }]);
      setDecryptedMessages(prev => ({ ...prev, [aiMsgId]: "System: Analyzing code structure..." }));
      const res = await fetch("/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: rawCode }) });
      const data = await res.json();
      await sendMessage(`[AI CODE REVIEW]\n\n${data.suggestion}`);
    } catch (err) { console.error("AI Review Trigger failed", err); }
  };

  const handleVoiceSend = async () => {
    const audioBlob = await stopRecording(); if (!audioBlob) return;
    setIsUploadingVoice(true);
    try {
      const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const formData = new FormData(); formData.append("file", file);
      const res = await fetch("/api/upload-voice", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error("Voice upload failed");
      await sendMessage(`AUDIO_PACKET:${data.url}`);
    } catch (err) { console.error("Voice upload error:", err); }
    finally { setIsUploadingVoice(false); }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setDeletingId(msgId);
    try {
      await fetch(`/api/messages/${msgId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, deleted: true } : m));
      setDecryptedMessages(prev => { const next = { ...prev }; delete next[msgId]; return next; });
      socketRef.current?.emit("delete-message", { messageId: msgId, peerId });
    } catch (err) { console.error("Delete failed:", err); }
    finally { setDeletingId(null); setDeleteConfirmId(null); }
  };

  const scrollToBottom = useCallback(() => { if (!isGrepActive) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [isGrepActive]);
  useEffect(() => { scrollToBottom(); }, [messages, isPeerTyping, decryptedMessages, scrollToBottom]);

  useEffect(() => {
    const loadChat = async () => {
      if (!userId || !peerId) return;
      try {
        const res = await fetch(`/api/messages?user1=${userId}&user2=${peerId}`);
        const data = await res.json(); setMessages(data);
        socketRef.current?.emit("seen-messages", { senderId: peerId, receiverId: userId });
        const userRes = await fetch(`/api/users/${peerId}`);
        const userData = await userRes.json();
        setPeerName(userData.username); setPeerAvatar(userData.avatar); setPeerPublicKey(userData.publicKey);
      } catch (err) { console.error("Failed to load chat data", err); }
    };
    loadChat();
  }, [userId, peerId, socketRef]);

  useEffect(() => {
    const decryptAll = async () => {
      const privKeyRaw = localStorage.getItem(`privKey_${userId}`);
      if (!privKeyRaw || messages.length === 0) return;
      try {
        const privKey = await importPrivateKey(privKeyRaw);
        const newDecrypted = { ...decryptedMessages }; let updated = false;
        for (const m of messages) {
          const msgId = m._id || m.createdAt; if (newDecrypted[msgId]) continue;
          try {
            const isMe = m.senderId === userId; const rawData = isMe ? m.contentSender : m.content;
            if (m.senderId === "AI_BOT") { newDecrypted[msgId] = m.content; updated = true; continue; }
            if (!rawData) { if (new Date().getTime() - new Date(m.createdAt).getTime() < 2000) continue; newDecrypted[msgId] = isMe ? "[History Unavailable]" : "[Encrypted Packet]"; updated = true; continue; }
            const { ct, iv, wk } = JSON.parse(rawData);
            const wrappedKeyBuffer = Uint8Array.from(atob(wk), (c) => c.charCodeAt(0));
            const aesKeyBuffer = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, wrappedKeyBuffer);
            const aesKey = await window.crypto.subtle.importKey("raw", aesKeyBuffer, { name: "AES-GCM" }, true, ["decrypt"]);
            const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(iv), c => c.charCodeAt(0)) }, aesKey, Uint8Array.from(atob(ct), c => c.charCodeAt(0)));
            newDecrypted[msgId] = new TextDecoder().decode(decryptedBuffer); updated = true;
          } catch (e) { console.error("Decryption error for message:", msgId, e); newDecrypted[msgId] = "[ERROR: DECRYPTION_FAILED]"; updated = true; }
        }
        if (updated) setDecryptedMessages(newDecrypted);
      } catch (err) { console.error("Hybrid Decryption setup failed", err); }
    };
    decryptAll();
  }, [messages, userId]);

  useEffect(() => {
    const socket = socketRef.current; if (!socket) return;
    const handleMessage = (msg: any) => {
      const isRelevant = (msg.senderId === userId && msg.receiverId === peerId) || (msg.senderId === peerId && msg.receiverId === userId);
      if (isRelevant) { if (msg.senderId === userId) return; setMessages(prev => [...prev, { ...msg, content: msg.content || msg.message, _id: msg._id || `temp-${Date.now()}` }]); if (msg.senderId === peerId) socket.emit("seen-messages", { senderId: peerId, receiverId: userId }); }
    };
    const handleSeen = ({ seenBy }: { seenBy: string }) => { if (seenBy === peerId) setMessages(prev => prev.map(m => m.senderId === userId ? { ...m, seen: true, delivered: true } : m)); };
    const handleTyping = ({ from, isTyping }: { from: string; isTyping: boolean }) => { if (from === peerId) setIsPeerTyping(isTyping); };
    const handleDelivered = ({ to, from }: { to: string; from: string }) => { if (from === userId && to === peerId) setMessages(prev => prev.map(m => m.senderId === userId && !m.seen ? { ...m, delivered: true } : m)); };
    const handleDeleted = ({ messageId }: { messageId: string }) => { setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true } : m)); setDecryptedMessages(prev => { const next = { ...prev }; delete next[messageId]; return next; }); };
    socket.on("message-deleted", handleDeleted); socket.on("receive-message", handleMessage); socket.on("messages-seen", handleSeen); socket.on("display-typing", handleTyping); socket.on("message-delivered", handleDelivered);
    return () => { socket.off("message-delivered", handleDelivered); socket.off("message-deleted", handleDeleted); socket.off("receive-message", handleMessage); socket.off("messages-seen", handleSeen); socket.off("display-typing", handleTyping); };
  }, [userId, peerId, socketRef]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setText(e.target.value);
    socketRef.current?.emit("typing", { to: peerId, from: userId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { socketRef.current?.emit("typing", { to: peerId, from: userId, isTyping: false }); }, 2000);
  };

  const sendMessage = async (overrideContent?: string) => {
    const baseContent = overrideContent || text;
    if (!baseContent.trim() || !peerPublicKey) return;
    const quoteText = replyingTo?.text.startsWith("REPLY_PACKET:") ? replyingTo.text.substring(replyingTo.text.lastIndexOf("|") + 1) : replyingTo?.text ?? "";
    const contentToSend = replyingTo ? `REPLY_PACKET:${quoteText}|${baseContent}` : baseContent;
    setReplyingTo(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit("typing", { to: peerId, from: userId, isTyping: false });
    try {
      const rawText = contentToSend; if (!overrideContent) setText("");
      const aesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedContent = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(rawText));
      const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
      const peerPub = await importPublicKey(peerPublicKey);
      const meData = await (await fetch(`/api/users/${userId}`)).json();
      const myPub = await importPublicKey(meData.publicKey);
      const wrappedKeyPeer = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, peerPub, exportedAesKey);
      const wrappedKeyMe = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, myPub, exportedAesKey);
      const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
      const packagePeer = JSON.stringify({ ct: b64(encryptedContent), iv: btoa(String.fromCharCode(...iv)), wk: b64(wrappedKeyPeer) });
      const packageMe = JSON.stringify({ ct: b64(encryptedContent), iv: btoa(String.fromCharCode(...iv)), wk: b64(wrappedKeyMe) });
      const tempId = `msg-${Date.now()}`;
      setMessages(prev => [...prev, { _id: tempId, senderId: userId, receiverId: peerId, content: packagePeer, contentSender: packageMe, createdAt: new Date().toISOString(), delivered: false, seen: false }]);
      setDecryptedMessages(prev => ({ ...prev, [tempId]: rawText }));
      socketRef.current?.emit("send-message", { to: peerId, message: packagePeer, senderId: userId });
      const dbRes = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderId: userId, receiverId: peerId, content: packagePeer, contentSender: packageMe }) });
      if (!dbRes.ok) throw new Error("Database failed to save");
      const saved = await dbRes.json();
      if (saved?._id) { setMessages(prev => prev.map(m => m._id === tempId ? { ...m, _id: saved._id } : m)); setDecryptedMessages(prev => { const next: Record<string, string> = { ...prev, [saved._id]: rawText }; delete next[tempId]; return next; }); }
    } catch (err) { console.error("Hybrid Transmission failed", err); }
  };

  const displayedMessages = isGrepActive
    ? messages.filter(m => (decryptedMessages[m._id || m.createdAt] || "").toLowerCase().includes(grepQuery.toLowerCase()))
    : messages;

  const onEmojiClick = (emojiData: any) => setText(prev => prev + emojiData.emoji);
  const nextBg = (cur: string) => ({ neural: "matrix", matrix: "particles", particles: "none", none: "neural" } as any)[cur];
  const bgLabel = { neural: "NEURAL", matrix: "MATRIX", particles: "BINARY", none: "NONE" } as any;

  return (
    <div className="flex flex-col h-full bg-[#090b0f] border-2 border-[#30363D] rounded-lg m-2.5 shadow-2xl font-mono overflow-hidden">
      <style>{`
        .chat-scroll::-webkit-scrollbar{width:6px}.chat-scroll::-webkit-scrollbar-track{background:#0D1117}.chat-scroll::-webkit-scrollbar-thumb{background:#30363D;border-radius:3px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp 0.15s ease-out}
        @keyframes rec-glow{0%,100%{box-shadow:0 0 0px #ff333300}50%{box-shadow:0 0 16px #ff333366}}.rec-pulse{animation:rec-glow 1.5s infinite ease-in-out}
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#161B22] border-b-2 border-[#30363D] shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-2 text-[#484F58] hover:text-[#C9D1D9] mr-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          <div className="w-8 h-8 rounded border border-[#30363D] bg-[#0D1117] overflow-hidden shrink-0">
            {peerAvatar && <img src={peerAvatar} className="w-full h-full object-cover" alt="" />}
          </div>
          <div>
            <div className="font-bold text-[#C9D1D9] text-sm leading-tight">
              {peerName?.toLowerCase() || "user"} <span className="text-[#7EE787] text-[10px]">[SECURE]</span>
            </div>
            {isPeerTyping && <div className="text-[10px] text-[#7EE787]">// typing...</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFreeAI(true)} className="text-[10px] text-[#484F58] border border-[#21262d] rounded px-1.5 py-1 hover:text-[#58A6FF] transition-colors tracking-widest">AI</button>
          <button onClick={() => setBgStyle(prev => nextBg(prev))} className="text-[10px] text-[#484F58] border border-[#21262d] rounded px-1.5 py-1 hover:text-[#7EE787] transition-colors tracking-widest">{bgLabel[bgStyle]}</button>
          <button onClick={() => { setIsGrepActive(!isGrepActive); setGrepQuery(""); }} className="text-[#8B949E] hover:text-[#7EE787] transition-colors p-1">
            {isGrepActive ? <span className="text-xs border border-[#30363D] px-1.5 py-0.5 rounded">ESC</span> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>}
          </button>
        </div>
      </div>

      {/* Grep bar */}
      {isGrepActive && (
        <div className="fade-up flex items-center px-4 py-2 bg-[#0D1117] border-b border-[#30363D] shrink-0">
          <span className="text-[#7EE787] text-xs mr-3">grep:</span>
          <input autoFocus value={grepQuery} onChange={e => setGrepQuery(e.target.value)} placeholder="search chat history..." className="flex-1 bg-transparent border-none outline-none text-[#C9D1D9] text-sm" />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden" style={{ outline: dragOver ? "2px dashed #58A6FF" : "2px solid transparent" }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
        {dragOver && <div className="absolute inset-0 bg-[#58A6FF08] z-10 flex items-center justify-center pointer-events-none"><span className="text-[#58A6FF] text-sm">// DROP_FILE_HERE</span></div>}
        {bgStyle === "neural" && <NeuralBg />}
        {bgStyle === "matrix" && <MatrixRain />}
        {bgStyle === "particles" && <ParticlesBg />}

        <div className="chat-scroll relative z-[1] h-full overflow-y-auto px-4 py-5 flex flex-col gap-3">
          {displayedMessages.length === 0 && isGrepActive && <div className="text-[#484F58] text-center text-xs mt-5">-- NO MATCHES FOUND FOR: {grepQuery} --</div>}

          {displayedMessages.map((m) => {
            const isMe = m.senderId === userId;
            const msgId = m._id || m.createdAt;
            const displayContent = decryptedMessages[msgId] || "Decrypting packet...";
            const isAI = m.senderId === "AI_BOT" || displayContent.startsWith("### 🧠 LOGIC_EXPLAINED");
            const isAudio = !m.deleted && displayContent.startsWith("AUDIO_PACKET:");
            const isFile = !m.deleted && displayContent.startsWith("FILE_PACKET:");

            return (
              <div key={msgId} className={`flex ${isAI ? "justify-center" : isMe ? "justify-end" : "justify-start"}`}>
                <div className="relative group">
                  {/* Hover actions */}
                  {!isAI && !m.deleted && (
                    <>
                      <button onClick={() => { setReplyingTo({ id: msgId, text: displayContent, sender: isMe ? "you" : peerName }); setTimeout(() => textareaRef.current?.focus(), 50); }}
                        className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[#7f858d] hover:text-[#C9D1D9] p-1 ${isMe ? "-left-7" : "-right-7"}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
                      </button>
                      {isMe && (
                        <button onClick={() => setDeleteConfirmId(msgId)} disabled={deletingId === msgId}
                          className="absolute top-1/2 -translate-y-1/2 -left-12 opacity-0 group-hover:opacity-100 transition-opacity text-[#f85149] p-1">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                        </button>
                      )}
                    </>
                  )}

                  {/* Bubble */}
                  <div onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setAiContextMenu({ x: e.clientX, y: e.clientY, msgId, content: displayContent }); }}
                    className={[
                      "rounded-xl",
                      isAI ? "px-4 py-3 border border-[#1a2a4a] bg-[#060b14]" :
                        (isAudio || isFile) ? `p-2 border ${isMe ? "border-[#238636] bg-[#23863622]" : "border-[#30363D] bg-[#161b2286]"}` :
                          `px-4 py-3 border ${isMe ? "border-[#238636] bg-[#23863622] text-[#7EE787]" : "border-[#30363D] bg-[#161b2286] text-[#C9D1D9]"}`
                    ].join(" ")}
                    style={{ maxWidth: isAI ? "min(95%, 560px)" : "min(85vw, 360px)", boxShadow: isAI ? "0 0 24px rgba(88,166,255,0.06), inset 0 1px 0 #1a2a4a44" : "none" }}>



                    <div className="text-sm">
                      {/* Prompt prefix — only for non-audio/file text messages */}
                      {!isAI && !isAudio && !isFile && !m.deleted && (
                        <span className={`mr-2 ${isMe ? "text-[#7EE787]" : "text-[#58A6FF]"}`}>
                          {isMe ? ">" : "$"}
                        </span>
                      )}

                      {m.deleted ? (
                        <span className="text-[#484F58] text-xs italic">// message_deleted</span>
                      ) : isAI ? (
                        <AIMessage content={displayContent} />
                      ) : isAudio ? (
                        <VoiceMessage src={displayContent.replace("AUDIO_PACKET:", "")} />
                      ) : isFile ? (
                        <FileMessage content={displayContent} />
                      ) : displayContent.startsWith("REPLY_PACKET:") ? (
                        <ReplyMessage content={displayContent} />
                      ) : (
                        <CodeReviewer text={displayContent} />
                      )}
                    </div>

                    {/* AI code action buttons */}
                    {!m.deleted && displayContent.includes("```") && (
                      <div className="flex gap-1.5 mt-2.5 flex-wrap">
                        <button onClick={() => requestAIReview(msgId, displayContent)}
                          className={`text-[9px] px-2 py-0.5 rounded border uppercase cursor-pointer ${isMe ? "text-[#58A6FF] border-[#58A6FF] bg-[#58A6FF11]" : "text-[#7EE787] border-[#238636] bg-[#23863611]"}`}>
                          {isMe ? "DEBUG_MY_CODE" : "RUN_AI_REVIEW"}
                        </button>
                        <button onClick={() => requestAIDescription(msgId, displayContent)}
                          className="text-[9px] text-[#58A6FF] border border-[#58A6FF] bg-[#58A6FF11] px-2 py-0.5 rounded uppercase cursor-pointer">
                          EXPLAIN_LOGIC
                        </button>
                        {!isMe && (
                          <button onClick={() => { setReviewData({ id: msgId, code: displayContent.replace(/###SENIOR_REVIEW\n\n/g, ""), comments: "" }); setIsReviewMode(true); }}
                            className="text-[9px] text-[#f1e05a] border border-[#f1e05a] bg-[#f1e05a11] px-2 py-0.5 rounded uppercase cursor-pointer">
                            OPEN_IN_EDITOR
                          </button>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center justify-end gap-1 mt-1.5 opacity-60">
                      <span className="text-[10px] text-[#484F58]">{new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMe && !isAI && <TickIcon status={getMessageStatus(m)} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Code editor panel */}
      {isReviewMode && (
        <div className="mx-4 bg-[#161B22] border border-[#f1e05a] rounded-t-lg p-3 shadow-2xl z-10 shrink-0">
          <div className="flex justify-between mb-2.5">
            <span className="text-[#f1e05a] text-[11px] font-bold">[EDITOR] // EDITING_REMOTE_SOURCE</span>
            <button onClick={() => setIsReviewMode(false)} className="text-[#f85149] bg-none border-none cursor-pointer text-xs">✕ CANCEL</button>
          </div>
          <div className="mb-2.5">
            <div className="text-[#8B949E] text-[10px] mb-1">// SOURCE_CODE</div>
            <textarea className="w-full bg-[#0D1117] text-[#7EE787] border border-[#30363D] rounded p-2.5 text-[13px] font-mono resize-y min-h-[120px] outline-none" value={reviewData.code} onChange={e => setReviewData({ ...reviewData, code: e.target.value })} spellCheck={false} />
          </div>
          <div>
            <div className="text-[#8B949E] text-[10px] mb-1">// MENTOR_NOTES</div>
            <textarea placeholder="Explain why you changed the code..." className="w-full bg-[#0D1117] text-[#C9D1D9] border border-[#30363D] rounded p-2.5 text-[13px] font-mono resize-none min-h-[60px] outline-none" value={reviewData.comments} onChange={e => setReviewData({ ...reviewData, comments: e.target.value })} />
          </div>
          <button onClick={async () => {
            const finalCode = reviewData.code.includes("```") ? reviewData.code : `\`\`\`\n${reviewData.code}\n\`\`\``;
            const fullReview = reviewData.comments.trim() ? `### SENIOR_PATCH\n\n${finalCode}\n\n---\n**NOTES:** ${reviewData.comments}` : `### SENIOR_PATCH\n\n${finalCode}`;
            await sendMessage(fullReview); setIsReviewMode(false);
          }} className="w-full mt-3 bg-[#f1e05a22] text-[#f1e05a] border border-[#f1e05a] py-2 rounded cursor-pointer text-xs font-bold hover:bg-[#f1e05a33] transition-colors">
            COMMIT_PATCH_TO_CHAT
          </button>
        </div>
      )}

      {/* Drag preview modal */}
      {draggedFile && (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center rounded-lg">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 w-80 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[#58A6FF] text-[11px]">// ATTACH_FILE</span>
              <button onClick={() => { setDraggedFile(null); setDragPreviewUrl(null); setDragCaption(""); }} className="text-[#f85149] cursor-pointer text-sm">✕</button>
            </div>
            {dragPreviewUrl ? <img src={dragPreviewUrl} alt="preview" className="w-full rounded border border-[#30363D] max-h-56 object-contain" />
              : <div className="p-5 bg-[#0D1117] border border-[#30363D] rounded text-center"><div className="text-2xl mb-2">📎</div><div className="text-[#8B949E] text-xs break-all">{draggedFile.name}</div><div className="text-[#484F58] text-[10px] mt-1">{(draggedFile.size / 1024).toFixed(1)} KB</div></div>}
            <input autoFocus placeholder="Add a caption... (optional)" value={dragCaption} onChange={e => setDragCaption(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleDragPreviewSend(); if (e.key === "Escape") { setDraggedFile(null); setDragPreviewUrl(null); setDragCaption(""); } }}
              className="bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-[#C9D1D9] text-[13px] font-mono outline-none" />
            <button onClick={handleDragPreviewSend} className="bg-[#23863622] text-[#7EE787] border border-[#238636] rounded py-2.5 cursor-pointer font-mono text-xs font-bold hover:bg-[#23863644] transition-colors">SEND_FILE</button>
          </div>
        </div>
      )}

      <FreeAIChat open={showFreeAI} onClose={() => setShowFreeAI(false)} onSendToChat={sendMessage} />
      <AskAIModal contextMenu={aiContextMenu} onCloseContextMenu={() => setAiContextMenu(null)} onSendToChat={sendMessage} />

      {/* Input section */}
      <div className="px-4 pt-3 pb-4 border-t-2 border-[#30363D] bg-[#161B22] shrink-0">
        {replyingTo && (
          <div className="flex items-center justify-between bg-[#0D1117] border-l-2 border-[#58A6FF] px-3 py-1.5 mb-2 rounded text-xs text-[#8B949E]">
            <span className="truncate">// replying: {replyingTo.text.startsWith("FILE_PACKET:") ? "[file]" : replyingTo.text.startsWith("AUDIO_PACKET:") ? "[voice]" : replyingTo.text.split("\n")[0].substring(0, 50)}</span>
            <button onClick={() => setReplyingTo(null)} className="text-[#f85149] cursor-pointer text-xs ml-2 shrink-0">✕</button>
          </div>
        )}

        {text.includes("```") && (
          <div className="px-2.5 py-2 bg-[#0D1117] border border-dashed border-[#238636] rounded-t text-xs mb-[-1px]">
            <div className="text-[#238636] text-[10px] mb-2">// PREVIEW_MODE: DETECTED_CODE_BLOCK</div>
            <CodeReviewer text={text} />
          </div>
        )}

        <div className="relative flex items-center gap-2 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-1">
          <span className="text-[#7EE787] font-bold text-sm ml-1 select-none shrink-0">$</span>
          <textarea ref={textareaRef} rows={text.split("\n").length > 3 ? 3 : 1}
            className="flex-1 bg-transparent border-none outline-none text-[#C9D1D9] font-mono text-sm resize-none py-2 px-1 overflow-y-auto"
            value={text} onChange={handleInputChange}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="type_message_here..." />

          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-3 z-[1000] shadow-2xl">
              <EmojiPicker theme={Theme.DARK} onEmojiClick={onEmojiClick} skinTonesDisabled searchPlaceholder="grep emoji..." width={300} height={400} />
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,*/*" className="hidden" onChange={handleFileSend} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingFile}
              className={`p-1.5 rounded border transition-all flex items-center justify-center ${isUploadingFile ? "border-[#58A6FF] text-[#58A6FF] bg-[#58A6FF11]" : "border-transparent text-[#8B949E] hover:text-[#C9D1D9]"}`}>
              {isUploadingFile ? <span className="text-[9px] font-bold">{uploadProgress}%</span>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>}
            </button>

            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-1.5 rounded border text-[#caac03] transition-all ${showEmojiPicker ? "border-[#caac03] bg-[#caac0311]" : "border-transparent hover:bg-[#30363D]"}`}>
              {showEmojiPicker
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>}
            </button>

            <button onMouseDown={startRecording} onMouseUp={handleVoiceSend} disabled={isUploadingVoice}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition-all ${isRecording ? "rec-pulse border-[#ff3333] text-[#ff3333] bg-[#ff333322]" : isUploadingVoice ? "border-[#58A6FF] text-[#58A6FF] bg-[#58A6FF22]" : "border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9]"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              {isRecording && <span className="text-[9px] font-bold">REC</span>}
              {isUploadingVoice && <span className="text-[9px] font-bold">UP...</span>}
            </button>

            <button onClick={() => sendMessage()}
              className="bg-[#23863622] text-[#7EE787] border border-[#238636] rounded px-4 py-1.5 cursor-pointer font-mono text-xs font-bold hover:bg-[#23863644] transition-colors">
              SEND
            </button>
          </div>
        </div>

        <div className="flex justify-between mt-2 px-1">
          <span className="text-[10px] text-[#484F58]">// tunnel_status: ACTIVE</span>
          <span className="text-[10px] text-[#484F58]">chars: {text.length}</span>
        </div>
      </div>

      {/* Delete confirm toast */}
      {deleteConfirmId && (
        <div className="fixed top-4 right-4 z-[9999] w-[300px] bg-[#0d1017] border border-[#3a1a1a] border-l-4 border-l-[#f85149] rounded-lg p-4 flex flex-col gap-3 shadow-2xl font-mono fade-up">
          <div className="flex items-center gap-2">
            <span className="text-[#f85149]">⚠</span>
            <span className="text-[#C9D1D9] text-xs font-bold">DELETE_MESSAGE</span>
          </div>
          <p className="text-[#8B949E] text-[11px] m-0 leading-relaxed">This will delete the message for everyone. This action cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => handleDeleteMessage(deleteConfirmId)} className="flex-1 bg-[#f8514922] text-[#f85149] border border-[#f85149] rounded py-1.5 cursor-pointer font-mono text-[11px] font-bold">CONFIRM_DELETE</button>
            <button onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-transparent text-[#8B949E] border border-[#30363D] rounded py-1.5 cursor-pointer font-mono text-[11px]">CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
}