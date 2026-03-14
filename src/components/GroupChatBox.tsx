"use client";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import CodeReviewer from "./CodeReviewer";
import VoiceMessage from "./VoiceMessage";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import ConfirmModal from "./ConfirmModal";
import EmojiPicker, { Theme } from "emoji-picker-react";

interface Member {
  _id: string;
  username: string;
  avatar?: string;
}
interface GroupChatBoxProps {
  userId: string;
  userAvatar: string;
  userName: string;
  groupId: string;
  groupName: string;
  members: Member[];
  isAdmin: boolean;
  onMembersUpdated?: (members: Member[]) => void;
  onGroupDeleted?: () => void;
  onBack?: () => void;
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
        <span className="text-[#a78bfa] text-xs">{type === "application/pdf" ? "[PDF] " : "[FILE] "}</span>
        <span className="text-[#a78bfa] text-xs cursor-pointer underline" onClick={() => window.open(url, "_blank")}>{name}</span>
      </div>
      {caption && <div className="text-[13px] text-[#C9D1D9] mt-1">{caption}</div>}
    </div>
  );
}

export default function GroupChatBox({
  userId, userAvatar, userName, groupId, groupName, members, isAdmin, onMembersUpdated, onGroupDeleted, onBack,
}: GroupChatBoxProps) {
  const socketRef = useSocket(userId);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = typeof window !== "undefined" ? { current: null as NodeJS.Timeout | null } : { current: null };
  const [showMembers, setShowMembers] = useState(false);
  const [isGrepActive, setIsGrepActive] = useState(false);
  const [grepQuery, setGrepQuery] = useState("");
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);
  const [dragPreviewUrl, setDragPreviewUrl] = useState<string | null>(null);
  const [dragCaption, setDragCaption] = useState("");
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewData, setReviewData] = useState({ id: "", code: "", comments: "" });
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; variant: "danger" | "info"; onConfirm: () => void; } | null>(null);

  // Join group room
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !groupId) return;
    socket.emit("join-group", groupId);
  }, [socketRef, groupId]);

  // Load messages
  useEffect(() => {
    if (!groupId) return;
    fetch(`/api/group-messages?groupId=${groupId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMessages(data); })
      .catch(console.error);
  }, [groupId]);

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handleGroupMessage = (msg: any) => {
      if (msg.groupId !== groupId) return;
      if (msg.senderId === userId) return;
      setMessages(prev => [...prev, msg]);
    };
    const handleTyping = ({ fromName, isTyping }: { from: string; fromName: string; isTyping: boolean }) => {
      setTypingUsers(prev => isTyping ? (prev.includes(fromName) ? prev : [...prev, fromName]) : prev.filter(n => n !== fromName));
    };
    socket.on("receive-group-message", handleGroupMessage);
    socket.on("group-display-typing", handleTyping);
    return () => { socket.off("receive-group-message", handleGroupMessage); socket.off("group-display-typing", handleTyping); };
  }, [socketRef, groupId, userId]);

  // Auto-scroll
  useEffect(() => {
    if (!isGrepActive) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, isGrepActive]);

  // Load users for add-member
  useEffect(() => {
    if (!showAddMember) return;
    fetch(`/api/users?myId=${userId}`).then(r => r.json()).then(data => { if (Array.isArray(data)) setAllUsers(data); }).catch(console.error);
  }, [showAddMember, userId]);

  // Group update socket
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handleGroupUpdate = (data: any) => {
      const isThisGroup = String(data.groupId) === String(groupId);
      const isMe = String(data.userId) === String(userId);
      if (data.action === "remove" && isThisGroup && isMe) {
        setModalConfig({ title: "ACCESS_REVOKED", message: "CRITICAL: Your access to this group has been terminated by an administrator.", variant: "danger", onConfirm: () => { onGroupDeleted?.(); } });
      }
      if (data.action === "delete" && isThisGroup) onGroupDeleted?.();
    };
    socket.on("group-updated", handleGroupUpdate);
    return () => { socket.off("group-updated", handleGroupUpdate); };
  }, [socketRef, groupId, userId, onGroupDeleted]);

  const sendMessage = async (overrideContent?: string) => {
    const content = overrideContent || text.trim();
    if (!content) return;
    if (!overrideContent) setText("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit("group-typing", { groupId, from: userId, fromName: userName, isTyping: false });
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { _id: tempId, groupId, senderId: userId, senderName: userName, senderAvatar: userAvatar, content, createdAt: new Date().toISOString(), isTemp: true }]);
    socketRef.current?.emit("send-group-message", { groupId, message: content, senderId: userId, senderName: userName, senderAvatar: userAvatar });
    try {
      await fetch("/api/group-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, senderId: userId, senderName: userName, senderAvatar: userAvatar, content }) });
    } catch (err) { console.error("Failed to save group message", err); }
  };

  const requestAIReview = async (msgId: string, rawCode: string) => {
    try {
      const aiMsgId = `ai-${Date.now()}`;
      setMessages(prev => [...prev, { _id: aiMsgId, senderId: "AI_BOT", content: "Analyzing code... please wait.", createdAt: new Date().toISOString() }]);
      const res = await fetch("/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: rawCode }) });
      const data = await res.json();
      setMessages(prev => prev.filter(m => m._id !== aiMsgId));
      await sendMessage(`[AI CODE REVIEW]\n\n${data.suggestion}`);
    } catch (err) { console.error("AI Review failed", err); }
  };

  const requestAIDescription = async (msgId: string, rawCode: string) => {
    try {
      const cleanCode = rawCode.replace(/### 🧠 LOGIC_EXPLAINED/g, "").replace(/\[SYSTEM_DIAGNOSTIC_REPORT\].*/g, "").trim();
      if (!cleanCode || cleanCode.includes("Analyzing logic flow")) return;
      const aiMsgId = `ai-desc-${Date.now()}`; const loadingText = "Analyzing logic flow... 🧠";
      setMessages(prev => [...prev, { _id: aiMsgId, senderId: "AI_BOT", content: loadingText, createdAt: new Date().toISOString() }]);
      const res = await fetch("/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: cleanCode, mode: "DESCRIBE" }) });
      const data = await res.json();
      setMessages(prev => prev.filter(m => m._id !== aiMsgId));
      if (data.suggestion) await sendMessage(`### 🧠 LOGIC_EXPLAINED\n\n${data.suggestion}`);
    } catch (err) { console.error("AI Description failed", err); }
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

  const handleFileSend = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
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
    const file = e.dataTransfer.files?.[0]; if (!file) return;
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    socketRef.current?.emit("group-typing", { groupId, from: userId, fromName: userName, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { socketRef.current?.emit("group-typing", { groupId, from: userId, fromName: userName, isTyping: false }); }, 2000);
  };

  const handleAddMember = async (memberId: string) => {
    const res = await fetch(`/api/groups/${groupId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId }) });
    if (res.ok) { const updated = await res.json(); onMembersUpdated?.(updated.members); setShowAddMember(false); }
  };

  const handleRemoveMember = (memberId: string) => {
    setModalConfig({ title: "MEMBER_REMOVAL", message: "Remove user from group?", variant: "danger", onConfirm: async () => {
      const res = await fetch(`/api/groups/${groupId}/members`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId }) });
      if (res.ok) { const updated = await res.json(); onMembersUpdated?.(updated.members); socketRef.current?.emit("trigger-group-update", { action: "remove", groupId, userId: memberId }); }
    }});
  };

  const handleExitGroup = () => {
    setModalConfig({ title: "TERMINATE_MEMBERSHIP", message: "Confirm group exit?", variant: "danger", onConfirm: async () => {
      const res = await fetch(`/api/groups/${groupId}/members`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: userId }) });
      if (res.ok) { socketRef.current?.emit("trigger-group-update", { action: "exit", groupId, userId }); onGroupDeleted?.(); }
    }});
  };

  const handleDeleteGroup = () => {
    setModalConfig({ title: "CRITICAL_ACTION: DELETE_GROUP", message: `WARNING: Permanently delete group "${groupName.toUpperCase()}"? This cannot be undone.`, variant: "danger", onConfirm: async () => {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (res.ok) { socketRef.current?.emit("trigger-group-update", { action: "delete", groupId }); onGroupDeleted?.(); }
    }});
  };

  const onEmojiClick = (emojiData: any) => setText(prev => prev + emojiData.emoji);

  const displayedMessages = isGrepActive
    ? messages.filter(m => m.content?.toLowerCase().includes(grepQuery.toLowerCase()))
    : messages;

  const nonMembers = allUsers
    .filter(u => !members.some(m => String(m._id) === String(u._id)))
    .filter(u => addSearch === "" || u.username.toLowerCase().includes(addSearch.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[#090b0f] border-2 border-[#6e40c9] rounded-lg m-2.5 shadow-[0_8px_32px_rgba(110,64,201,0.2)] font-mono overflow-hidden">
      <style>{`
        .grp-scroll::-webkit-scrollbar{width:6px}.grp-scroll::-webkit-scrollbar-track{background:#0D1117}.grp-scroll::-webkit-scrollbar-thumb{background:#6e40c9;border-radius:3px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp 0.15s ease-out}
        @keyframes rec-glow{0%,100%{box-shadow:0 0 0px #ff333300}50%{box-shadow:0 0 16px #ff333366}}.rec-pulse{animation:rec-glow 1.5s infinite ease-in-out}
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#161B22] border-b-2 border-[#6e40c9] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#6e40c933] border border-[#6e40c9] flex items-center justify-center text-sm shrink-0">👥</div>
          <div>
            <div className="font-bold text-[#C9D1D9] text-sm leading-tight">
              {groupName} <span className="text-[#a78bfa] text-[10px]">[GROUP]</span>
            </div>
            <div className="text-[10px] text-[#6e40c9]">
              {typingUsers.length > 0
                ? `// ${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing...`
                : `// ${members.length} member${members.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setIsGrepActive(!isGrepActive); setGrepQuery(""); }} className="text-[#8B949E] hover:text-[#a78bfa] transition-colors p-1">
            {isGrepActive ? <span className="text-xs border border-[#30363D] px-1.5 py-0.5 rounded">ESC</span>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>}
          </button>
          <button onClick={() => setShowMembers(!showMembers)}
            className={`text-[10px] text-[#a78bfa] rounded px-2 py-1 border transition-colors ${showMembers ? "bg-[#6e40c922] border-[#6e40c9]" : "bg-transparent border-transparent hover:border-[#6e40c966]"}`}>
            MEMBERS
          </button>
          {isAdmin
            ? <button onClick={handleDeleteGroup} className="text-[10px] text-[#f85149] border border-[#f8514933] rounded px-2 py-1 hover:bg-[#f8514922] transition-colors">DELETE</button>
            : <button onClick={handleExitGroup} className="text-[10px] text-[#e3b341] border border-[#e3b34133] rounded px-2 py-1 hover:bg-[#e3b34122] transition-colors">EXIT</button>}
        </div>
      </div>

      {/* Grep bar */}
      {isGrepActive && (
        <div className="fade-up flex items-center px-4 py-2 bg-[#0D1117] border-b border-[#30363D] shrink-0">
          <span className="text-[#a78bfa] text-xs mr-3">grep:</span>
          <input autoFocus value={grepQuery} onChange={e => setGrepQuery(e.target.value)} placeholder="search group history..."
            className="flex-1 bg-transparent border-none outline-none text-[#C9D1D9] text-sm" />
        </div>
      )}

      {/* Body: messages + optional members panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 relative overflow-hidden" style={{ outline: dragOver ? "2px dashed #6e40c9" : "2px solid transparent" }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}>
          {dragOver && (
            <div className="absolute inset-0 bg-[#6e40c908] z-10 flex items-center justify-center pointer-events-none">
              <span className="text-[#a78bfa] text-sm">// DROP_FILE_HERE</span>
            </div>
          )}
          <div className="grp-scroll h-full overflow-y-auto px-4 py-5 flex flex-col gap-3">
            {displayedMessages.length === 0 && !isGrepActive && (
              <div className="text-[#484F58] text-center text-xs mt-10">
                <div className="mb-2">👥</div>
                <div>// group_channel_initialized</div>
                <div className="opacity-60">Send the first message!</div>
              </div>
            )}
            {displayedMessages.length === 0 && isGrepActive && (
              <div className="text-[#484F58] text-center text-xs mt-5">-- NO MATCHES FOR: {grepQuery} --</div>
            )}

            {displayedMessages.map((m) => {
              const isMe = String(m.senderId) === userId;
              const msgId = m._id || m.createdAt;
              const isAI = m.senderId === "AI_BOT" || m.content?.startsWith("### 🧠 LOGIC_EXPLAINED");
              const isAudio = m.content?.startsWith("AUDIO_PACKET:");
              const isFile = m.content?.startsWith("FILE_PACKET:");

              return (
                <div key={msgId} className={`flex ${isAI ? "justify-center" : isMe ? "justify-end" : "justify-start"}`}>
                  <div style={{ maxWidth: isAI ? "95%" : "min(80%, 360px)" }}>
                    {/* Sender name */}
                    {!isMe && !isAI && (
                      <div className="text-[10px] text-[#a78bfa] mb-0.5 pl-1">{m.senderName?.toLowerCase()}</div>
                    )}

                    {/* Bubble */}
                    <div className={[
                      "rounded-lg",
                      isAI ? "px-4 py-3 border border-double border-[#58A6FF] bg-[#0d1117] text-[#C9D1D9]" :
                        (isAudio || isFile) ? `p-2 border ${isMe ? "border-[#6e40c9] bg-[#6e40c922]" : "border-[#30363D] bg-[#161B22]"}` :
                          `px-4 py-3 border ${isMe ? "border-[#6e40c9] bg-[#6e40c922]" : "border-[#30363D] bg-[#161B22]"} text-[#C9D1D9]`
                    ].join(" ")}>
                      {isAI && <div className="text-[9px] text-[#58A6FF] mb-2 pb-1 border-b border-[#58A6FF33]">[SYSTEM_DIAGNOSTIC_REPORT] // SOURCE: NEURAL_ENGINE</div>}

                      <div className="text-sm">
                        {!isAudio && !isFile && (
                          <span className={`mr-2 ${isAI ? "text-[#58A6FF]" : isMe ? "text-[#a78bfa]" : "text-[#58A6FF]"}`}>
                            {isAI ? "⚡" : isMe ? ">" : "$"}
                          </span>
                        )}
                        {isAI ? (
                          <span className="whitespace-pre-wrap break-words text-[13px] text-[#ADC6FF]">
                            {m.content?.replace("### 🧠 LOGIC_EXPLAINED", "").trim()}
                          </span>
                        ) : isAudio ? (
                          <VoiceMessage src={m.content.replace("AUDIO_PACKET:", "")} />
                        ) : isFile ? (
                          <FileMessage content={m.content} />
                        ) : (
                          <CodeReviewer text={m.content} />
                        )}
                      </div>

                      {/* AI code buttons */}
                      {m.content?.includes("```") && !isAI && (
                        <div className="flex gap-1.5 mt-2.5 flex-wrap">
                          <button onClick={() => requestAIReview(msgId, m.content)}
                            className={`text-[9px] px-2 py-0.5 rounded border uppercase cursor-pointer ${isMe ? "text-[#58A6FF] border-[#58A6FF] bg-[#58A6FF11]" : "text-[#7EE787] border-[#238636] bg-[#23863611]"}`}>
                            {isMe ? "DEBUG_MY_CODE" : "RUN_AI_REVIEW"}
                          </button>
                          <button onClick={() => requestAIDescription(msgId, m.content)}
                            className="text-[9px] text-[#58A6FF] border border-[#58A6FF] bg-[#58A6FF11] px-2 py-0.5 rounded uppercase cursor-pointer">
                            EXPLAIN_LOGIC
                          </button>
                          {!isMe && (
                            <button onClick={() => { setReviewData({ id: msgId, code: m.content.replace(/###SENIOR_REVIEW\n\n/g, ""), comments: "" }); setIsReviewMode(true); }}
                              className="text-[9px] text-[#f1e05a] border border-[#f1e05a] bg-[#f1e05a11] px-2 py-0.5 rounded uppercase cursor-pointer">
                              OPEN_IN_EDITOR
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end mt-1.5 opacity-50">
                        <span className="text-[10px] text-[#484F58]">
                          {new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="fade-up grp-scroll w-48 border-l border-[#6e40c9] bg-[#0D1117] overflow-y-auto flex flex-col shrink-0">
            <div className="px-3 py-2.5 border-b border-[#6e40c933] text-[10px] text-[#a78bfa] font-bold">
              // MEMBERS ({members.length})
            </div>
            {isAdmin && (
              <button onClick={() => setShowAddMember(!showAddMember)}
                className="mx-2 my-2 py-1 bg-[#6e40c922] border border-dashed border-[#6e40c9] rounded text-[#a78bfa] text-[10px] cursor-pointer hover:bg-[#6e40c933] transition-colors">
                + ADD_MEMBER
              </button>
            )}
            {showAddMember && isAdmin && (
              <div className="fade-up px-2 pb-2">
                <input autoFocus placeholder="SEARCH_USER..." value={addSearch} onChange={e => setAddSearch(e.target.value)}
                  className="w-full bg-[#161B22] border border-[#6e40c9] rounded text-[#C9D1D9] px-2 py-1 text-[11px] outline-none box-border" />
                {nonMembers.slice(0, 6).map(u => (
                  <div key={u._id} onClick={() => handleAddMember(u._id)}
                    className="px-1.5 py-1 text-[11px] text-[#C9D1D9] cursor-pointer rounded mt-0.5 hover:bg-[#6e40c922] transition-colors">
                    + {u.username?.toLowerCase()}
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1">
              {members.map(m => (
                <div key={m._id} className="px-3 py-2 flex items-center gap-2 border-b border-[#6e40c911]">
                  <div className="w-6 h-6 rounded-full bg-[#6e40c933] border border-[#6e40c9] flex items-center justify-center text-[10px] overflow-hidden shrink-0">
                    {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover" alt="" /> : m.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className={`text-[11px] truncate ${String(m._id) === userId ? "text-[#a78bfa]" : "text-[#C9D1D9]"}`}>
                      {m.username?.toLowerCase()}{String(m._id) === userId ? " [you]" : ""}
                    </div>
                  </div>
                  {isAdmin && String(m._id) !== userId && (
                    <button onClick={() => handleRemoveMember(m._id)} className="text-[#f85149] text-[10px] cursor-pointer bg-none border-none p-0">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Code editor panel */}
      {isReviewMode && (
        <div className="mx-4 bg-[#161B22] border border-[#f1e05a] rounded-t-lg p-3 shadow-2xl z-10 shrink-0">
          <div className="flex justify-between mb-2.5">
            <span className="text-[#f1e05a] text-[11px] font-bold">[EDITOR] // EDITING_REMOTE_SOURCE</span>
            <button onClick={() => setIsReviewMode(false)} className="text-[#f85149] cursor-pointer text-xs bg-none border-none">✕ CANCEL</button>
          </div>
          <div className="mb-2.5">
            <div className="text-[#8B949E] text-[10px] mb-1">// SOURCE_CODE</div>
            <textarea className="w-full bg-[#0D1117] text-[#7EE787] border border-[#30363D] rounded p-2.5 text-[13px] font-mono resize-y min-h-[120px] outline-none"
              value={reviewData.code} onChange={e => setReviewData({ ...reviewData, code: e.target.value })} spellCheck={false} />
          </div>
          <div>
            <div className="text-[#8B949E] text-[10px] mb-1">// MENTOR_NOTES</div>
            <textarea placeholder="Explain why you changed the code..."
              className="w-full bg-[#0D1117] text-[#C9D1D9] border border-[#30363D] rounded p-2.5 text-[13px] font-mono resize-none min-h-[60px] outline-none"
              value={reviewData.comments} onChange={e => setReviewData({ ...reviewData, comments: e.target.value })} />
          </div>
          <button onClick={async () => {
            const finalCode = reviewData.code.includes("```") ? reviewData.code : `\`\`\`\n${reviewData.code}\n\`\`\``;
            const fullReview = reviewData.comments.trim() ? `### REVIEWED/EDITED\n\n${finalCode}\n\n---\n**NOTES:** ${reviewData.comments}` : `### REVIEWED/EDITED\n\n${finalCode}`;
            await sendMessage(fullReview); setIsReviewMode(false);
          }} className="w-full mt-3 bg-[#f1e05a22] text-[#f1e05a] border border-[#f1e05a] py-2 rounded cursor-pointer text-xs font-bold hover:bg-[#f1e05a33] transition-colors">
            COMMIT_PATCH_TO_CHAT
          </button>
        </div>
      )}

      {/* Drag preview modal */}
      {draggedFile && (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center rounded-lg">
          <div className="bg-[#161B22] border border-[#6e40c9] rounded-lg p-5 w-80 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[#a78bfa] text-[11px]">// ATTACH_FILE</span>
              <button onClick={() => { setDraggedFile(null); setDragPreviewUrl(null); setDragCaption(""); }} className="text-[#f85149] cursor-pointer text-sm">✕</button>
            </div>
            {dragPreviewUrl
              ? <img src={dragPreviewUrl} alt="preview" className="w-full rounded border border-[#30363D] max-h-56 object-contain" />
              : <div className="p-5 bg-[#0D1117] border border-[#30363D] rounded text-center"><div className="text-2xl mb-2">📎</div><div className="text-[#8B949E] text-xs break-all">{draggedFile.name}</div><div className="text-[#484F58] text-[10px] mt-1">{(draggedFile.size / 1024).toFixed(1)} KB</div></div>}
            <input autoFocus placeholder="Add a caption... (optional)" value={dragCaption}
              onChange={e => setDragCaption(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleDragPreviewSend(); if (e.key === "Escape") { setDraggedFile(null); setDragPreviewUrl(null); setDragCaption(""); } }}
              className="bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-[#C9D1D9] text-[13px] font-mono outline-none" />
            <button onClick={handleDragPreviewSend} className="bg-[#6e40c922] text-[#a78bfa] border border-[#6e40c9] rounded py-2.5 cursor-pointer font-mono text-xs font-bold hover:bg-[#6e40c944] transition-colors">
              SEND_FILE
            </button>
          </div>
        </div>
      )}

      {/* Input section */}
      <div className="px-4 pt-3 pb-4 border-t-2 border-[#6e40c9] bg-[#161B22] shrink-0">
        {text.includes("```") && (
          <div className="px-2.5 py-2 bg-[#0D1117] border border-dashed border-[#6e40c9] rounded-t text-xs mb-[-1px]">
            <div className="text-[#6e40c9] text-[10px] mb-2">// PREVIEW_MODE: DETECTED_CODE_BLOCK</div>
            <CodeReviewer text={text} />
          </div>
        )}

        <div className="relative flex items-center gap-2 bg-[#0D1117] border border-[#6e40c9] rounded-lg px-2 py-1">
          <span className="text-[#a78bfa] font-bold text-sm ml-1 select-none shrink-0">$</span>
          <textarea rows={text.split("\n").length > 3 ? 3 : 1}
            className="flex-1 bg-transparent border-none outline-none text-[#C9D1D9] font-mono text-sm resize-none py-2 px-1 overflow-y-auto"
            value={text} onChange={handleInputChange}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="type_group_message..." />

          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-3 z-[1000] shadow-2xl">
              <EmojiPicker theme={Theme.DARK} onEmojiClick={onEmojiClick} skinTonesDisabled searchPlaceholder="grep emoji..." width={300} height={400} />
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {/* File attach */}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,*/*" className="hidden" onChange={handleFileSend} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingFile}
              className={`p-1.5 rounded border transition-all flex items-center justify-center ${isUploadingFile ? "border-[#a78bfa] text-[#a78bfa] bg-[#6e40c911]" : "border-transparent text-[#8B949E] hover:text-[#C9D1D9]"}`}
              title={isUploadingFile ? "UPLOADING..." : "ATTACH_FILE"}>
              {isUploadingFile
                ? <span className="text-[9px] font-bold">{uploadProgress}%</span>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>}
            </button>

            {/* Emoji */}
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-1.5 rounded border text-[#caac03] transition-all ${showEmojiPicker ? "border-[#caac03] bg-[#caac0311]" : "border-transparent hover:bg-[#30363D]"}`}>
              {showEmojiPicker
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>}
            </button>

            {/* Mic */}
            <button onMouseDown={startRecording} onMouseUp={handleVoiceSend} disabled={isUploadingVoice}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition-all ${isRecording ? "rec-pulse border-[#ff3333] text-[#ff3333] bg-[#ff333322]" : isUploadingVoice ? "border-[#58A6FF] text-[#58A6FF] bg-[#58A6FF22]" : "border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9]"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              {isRecording && <span className="text-[9px] font-bold">REC</span>}
              {isUploadingVoice && <span className="text-[9px] font-bold">UP...</span>}
            </button>

            {/* Send */}
            <button onClick={() => sendMessage()}
              className="bg-[#6e40c922] text-[#a78bfa] border border-[#6e40c9] rounded px-4 py-1.5 cursor-pointer font-mono text-xs font-bold hover:bg-[#6e40c944] transition-colors">
              SEND
            </button>
          </div>
        </div>

        <div className="flex justify-between mt-2 px-1">
          <span className="text-[10px] text-[#484F58]">// group_channel: {groupName?.toLowerCase()}</span>
          <span className="text-[10px] text-[#484F58]">chars: {text.length}</span>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!modalConfig}
        title={modalConfig?.title}
        message={modalConfig?.message || ""}
        variant={modalConfig?.variant}
        onConfirm={() => { modalConfig?.onConfirm(); setModalConfig(null); }}
        onCancel={() => setModalConfig(null)}
      />
    </div>
  );
}