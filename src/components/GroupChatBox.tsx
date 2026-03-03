"use client";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import CodeReviewer from "./CodeReviewer";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import ConfirmModal from "./ConfirmModal";
import EmojiPicker, { Theme } from 'emoji-picker-react';


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
}

export default function GroupChatBox({
  userId,
  userAvatar,
  userName,
  groupId,
  groupName,
  members,
  isAdmin,
  onMembersUpdated,
  onGroupDeleted,
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
  
  const messagesEndRef = { current: null as HTMLDivElement | null };
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [modalConfig, setModalConfig] = useState<{
  title: string;
  message: string;
  variant: "danger" | "info";
  onConfirm: () => void;
} | null>(null);

  // Join the group socket room
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !groupId) return;
    socket.emit("join-group", groupId);
  }, [socketRef, groupId]);

  // Load group messages from DB
  useEffect(() => {
    if (!groupId) return;
    fetch(`/api/group-messages?groupId=${groupId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(console.error);
  }, [groupId]);

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleGroupMessage = (msg: any) => {
      if (msg.groupId !== groupId) return;
      // Avoid echoing own messages (we add them optimistically)
      if (msg.senderId === userId) return;
      setMessages((prev) => [...prev, msg]);
    };

 

    const handleTyping = ({ fromName, isTyping }: { from: string; fromName: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        if (isTyping) return prev.includes(fromName) ? prev : [...prev, fromName];
        return prev.filter((n) => n !== fromName);
      });
    };

    socket.on("receive-group-message", handleGroupMessage);
    socket.on("group-display-typing", handleTyping);

    return () => {
      socket.off("receive-group-message", handleGroupMessage);
      socket.off("group-display-typing", handleTyping);
    };
  }, [socketRef, groupId, userId]);

  // Auto-scroll
  useEffect(() => {
    if (!isGrepActive) {
      (messagesEndRef as any).current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, typingUsers, isGrepActive]);

  // Load users for add-member panel
  useEffect(() => {
    if (!showAddMember) return;
    fetch(`/api/users?myId=${userId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllUsers(data); })
      .catch(console.error);
  }, [showAddMember, userId]);

  // Inside GroupChatBox component
useEffect(() => {
  const socket = socketRef.current;
  if (!socket) return;

  const handleGroupUpdate = (data: any) => {
    const isThisGroup = String(data.groupId) === String(groupId);
    const isMe = String(data.userId) === String(userId);

    // Action: REMOVE (Kicked by Admin)
    if (data.action === "remove" && isThisGroup && isMe) {
  // 1. Show the Modal with only an "OK" option
  setModalConfig({
    title: "ACCESS_REVOKED",
    message: "CRITICAL: Your access to this group has been terminated by an administrator.",
    variant: "danger",
    onConfirm: () => {
      onGroupDeleted?.(); // Only close the chat AFTER they click OK
    }
  });
}

    // Action: DELETE (Group Destroyed)
    if (data.action === "delete" && isThisGroup) {
      onGroupDeleted?.();
    }
  };

  socket.on("group-updated", handleGroupUpdate);
  return () => { socket.off("group-updated", handleGroupUpdate); };
}, [socketRef, groupId, userId, onGroupDeleted]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    socketRef.current?.emit("group-typing", { groupId, from: userId, fromName: userName, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("group-typing", { groupId, from: userId, fromName: userName, isTyping: false });
    }, 2000);
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit("group-typing", { groupId, from: userId, fromName: userName, isTyping: false });

    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      _id: tempId,
      groupId,
      senderId: userId,
      senderName: userName,
      senderAvatar: userAvatar,
      content,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    // Emit to socket for real-time delivery
    socketRef.current?.emit("send-group-message", {
      groupId,
      message: content,
      senderId: userId,
      senderName: userName,
      senderAvatar: userAvatar,
    });

    // Persist to DB
    try {
      await fetch("/api/group-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, senderId: userId, senderName: userName, senderAvatar: userAvatar, content }),
      });
    } catch (err) {
      console.error("Failed to save group message", err);
    }
  };

  const handleAddMember = async (memberId: string) => {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) {
      const updated = await res.json();
      onMembersUpdated?.(updated.members);
      setShowAddMember(false);
    }
  };

 const handleRemoveMember = (memberId: string) => {
  // 1. Open the modal by setting the config
  setModalConfig({
    title: "MEMBER_REMOVAL",
    message: `Remove user from group?`,
    variant: "danger",
    onConfirm: async () => {
      // 2. This code runs only when they click "PROCEED"
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      if (res.ok) {
        const updated = await res.json();
        onMembersUpdated?.(updated.members);

        // Notify other clients via socket
        socketRef.current?.emit("trigger-group-update", {
          action: "remove",
          groupId: groupId,
          userId: memberId,
        });
      }
    },
  });
};
  const handleExitGroup = () => {
  setModalConfig({
    title: "TERMINATE_MEMBERSHIP",
    message: "Confirm group exit?",
    variant: "danger",
    onConfirm: async () => {
      // Logic inside the modal confirm button
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: userId }),
      });

      if (res.ok) {
        // 1. Tell the server to broadcast the exit
        socketRef.current?.emit("trigger-group-update", {
          action: "exit",
          groupId: groupId,
          userId: userId
        });
        
        // 2. Local cleanup (this closes the chat box)
        onGroupDeleted?.();
      }
    },
  });
};

const handleDeleteGroup = () => {
  setModalConfig({
    title: "CRITICAL_ACTION: DELETE_GROUP",
    message: `WARNING: Permanently delete group "${groupName.toUpperCase()}"? This action will purge all message history and member associations from the core database. This cannot be undone.`,
    variant: "danger",
    onConfirm: async () => {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });

      if (res.ok) {
        // 1. Tell the server to broadcast the deletion to all members
        socketRef.current?.emit("trigger-group-update", {
          action: "delete",
          groupId: groupId
        });
        
        // 2. Local cleanup (unmounts the chatbox)
        onGroupDeleted?.();
      } else {
        console.error("Failed to delete group");
        // Optional: show an error variant modal here
      }
    },
  });
};

  const handleVoiceSend = async () => {
    const base64Audio = await stopRecording();
    if (!base64Audio) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit("group-typing", { groupId, from: userId, fromName: userName, isTyping: false });

    const content = `AUDIO_PACKET:${base64Audio}`;
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      _id: tempId,
      groupId,
      senderId: userId,
      senderName: userName,
      senderAvatar: userAvatar,
      content,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    socketRef.current?.emit("send-group-message", {
      groupId,
      message: content,
      senderId: userId,
      senderName: userName,
      senderAvatar: userAvatar,
    });

    try {
      await fetch("/api/group-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, senderId: userId, senderName: userName, senderAvatar: userAvatar, content }),
      });
    } catch (err) {
      console.error("Failed to save audio message", err);
    }
  };

  const displayedMessages = isGrepActive
    ? messages.filter((m) => m.content?.toLowerCase().includes(grepQuery.toLowerCase()))
    : messages;

  const nonMembers = allUsers.filter(
    (u) => !members.some((m) => String(m._id) === String(u._id))
  ).filter((u) =>
    addSearch === "" || u.username.toLowerCase().includes(addSearch.toLowerCase())
  );

       const onEmojiClick = (emojiData: any) => {
    setText((prev) => prev + emojiData.emoji);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#090b0f", border: "2px solid #6e40c9", borderRadius: "8px", margin: "10px", boxShadow: "0 8px 32px rgba(110,64,201,0.2)", fontFamily: "'Fira Code', monospace", overflow: "hidden" }}>
      <style>{`
        .group-scroll::-webkit-scrollbar { width: 8px; }
        .group-scroll::-webkit-scrollbar-track { background: #0D1117; }
        .group-scroll::-webkit-scrollbar-thumb { background: #6e40c9; border-radius: 4px; }
        .fade-in { animation: fadeIn 0.2s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ background: "#161B22", padding: "12px 16px", borderBottom: "2px solid #6e40c9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#6e40c933", border: "1px solid #6e40c9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
            👥
          </div>
          <div>
            <div style={{ fontWeight: "bold", color: "#C9D1D9", fontSize: "14px" }}>
              {groupName} <span style={{ color: "#a78bfa", fontSize: "10px" }}>[GROUP]</span>
            </div>
            <div style={{ fontSize: "10px", color: "#6e40c9" }}>
              {typingUsers.length > 0
                ? `// ${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing...`
                : `// ${members.length} member${members.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Search button */}
          <button
            onClick={() => { setIsGrepActive(!isGrepActive); setGrepQuery(""); }}
            style={{ background: "transparent", border: "none", color: isGrepActive ? "#a78bfa" : "#8B949E", cursor: "pointer" }}
          >
            {isGrepActive ? (
              <span style={{ fontSize: "12px", border: "1px solid #30363D", padding: "2px 6px", borderRadius: "4px" }}>ESC</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            )}
          </button>

          {/* Members panel toggle */}
          <button
            onClick={() => setShowMembers(!showMembers)}
            style={{ background: showMembers ? "#6e40c922" : "transparent", border: showMembers ? "1px solid #6e40c9" : "none", color: "#a78bfa", cursor: "pointer", borderRadius: "4px", padding: "4px 8px", fontSize: "10px", fontFamily: "inherit" }}
          >
            MEMBERS
          </button>

          {/* Delete group (admin only) OR Exit group (non-admin) */}
          {isAdmin ? (
            <button
              onClick={handleDeleteGroup}
              style={{ background: "transparent", border: "1px solid #f8514933", color: "#f85149", cursor: "pointer", borderRadius: "4px", padding: "4px 8px", fontSize: "10px", fontFamily: "inherit", transition: "all 0.2s" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f8514922")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              title="Delete group (admin only)"
            >
              DELETE
            </button>
          ) : (
            <button
              onClick={handleExitGroup}
              style={{ background: "transparent", border: "1px solid #e3b34133", color: "#e3b341", cursor: "pointer", borderRadius: "4px", padding: "4px 8px", fontSize: "10px", fontFamily: "inherit", transition: "all 0.2s" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#e3b34122")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              title="Leave group"
            >
              EXIT
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {isGrepActive && (
        <div className="fade-in" style={{ background: "#0D1117", padding: "8px 16px", borderBottom: "1px solid #30363D", display: "flex", alignItems: "center" }}>
          <span style={{ color: "#a78bfa", marginRight: "10px", fontSize: "12px" }}>grep:</span>
          <input
            autoFocus
            style={{ flex: 1, background: "transparent", border: "none", color: "#C9D1D9", outline: "none", fontSize: "14px" }}
            placeholder="search group history..."
            value={grepQuery}
            onChange={(e) => setGrepQuery(e.target.value)}
          />
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Messages area */}
        <div className="group-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {displayedMessages.length === 0 && !isGrepActive && (
            <div style={{ color: "#484F58", textAlign: "center", marginTop: "40px", fontSize: "12px" }}>
              <div style={{ marginBottom: "8px" }}>👥</div>
              <div>// group_channel_initialized</div>
              <div style={{ opacity: 0.6 }}>Send the first message!</div>
            </div>
          )}
          {displayedMessages.length === 0 && isGrepActive && (
            <div style={{ color: "#484F58", textAlign: "center", marginTop: "20px", fontSize: "12px" }}>
              -- NO MATCHES FOR: {grepQuery} --
            </div>
          )}

          {displayedMessages.map((m) => {
            const isMe = String(m.senderId) === userId;
            const msgId = m._id || m.createdAt;
            return (
              <div key={msgId} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                {!isMe && (
                  <div style={{ fontSize: "10px", color: "#a78bfa", marginBottom: "3px", paddingLeft: "4px" }}>
                    {m.senderName?.toLowerCase()}
                  </div>
                )}
                <div style={{
                  borderRadius: "4px",
                  padding: "10px 14px",
                  border: isMe ? "1px solid #6e40c9" : "1px solid #30363D",
                  background: isMe ? "#6e40c922" : "#161B22",
                  color: "#C9D1D9",
                }}>
                  <div style={{ fontSize: "14px" }}>
                    <span style={{ color: isMe ? "#a78bfa" : "#58A6FF", marginRight: "8px" }}>
                      {isMe ? ">" : "$"}
                    </span>
                    <CodeReviewer text={m.content} />
                  </div>
                  <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.5, textAlign: "right" }}>
                    {new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={(el) => { (messagesEndRef as any).current = el; }} />
        </div>

        {/* Members Panel */}
        {showMembers && (
          <div className="fade-in group-scroll" style={{ width: "200px", borderLeft: "1px solid #6e40c9", background: "#0D1117", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #6e40c933", fontSize: "10px", color: "#a78bfa", fontWeight: "bold" }}>
              // MEMBERS ({members.length})
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                style={{ margin: "8px", padding: "5px", background: "#6e40c922", border: "1px dashed #6e40c9", borderRadius: "4px", color: "#a78bfa", fontSize: "10px", cursor: "pointer", fontFamily: "inherit" }}
              >
                + ADD_MEMBER
              </button>
            )}
            {showAddMember && isAdmin && (
              <div className="fade-in" style={{ padding: "0 8px 8px" }}>
                <input
                  autoFocus
                  placeholder="SEARCH_USER..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  style={{ width: "100%", background: "#161B22", border: "1px solid #6e40c9", borderRadius: "4px", color: "#C9D1D9", padding: "4px 6px", fontSize: "11px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                />
                {nonMembers.slice(0, 6).map((u) => (
                  <div
                    key={u._id}
                    onClick={() => handleAddMember(u._id)}
                    style={{ padding: "5px 6px", fontSize: "11px", color: "#C9D1D9", cursor: "pointer", borderRadius: "3px", marginTop: "3px" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#6e40c922")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    + {u.username?.toLowerCase()}
                  </div>
                ))}
              </div>
            )}
            <div style={{ flex: 1 }}>
              {members.map((m) => (
                <div key={m._id} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #6e40c911" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#6e40c933", border: "1px solid #6e40c9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", overflow: "hidden", flexShrink: 0 }}>
                    {m.avatar ? <img src={m.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : m.username?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "11px", color: String(m._id) === userId ? "#a78bfa" : "#C9D1D9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.username?.toLowerCase()}{String(m._id) === userId ? " [you]" : ""}
                    </div>
                  </div>
                  {isAdmin && String(m._id) !== userId && (
                    <button
                      onClick={() => handleRemoveMember(m._id)}
                      style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", fontSize: "10px", padding: 0 }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Section */}
      <div style={{ padding: "16px", borderTop: "2px solid #6e40c9", background: "#161B22" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", background: "#0D1117", border: "1px solid #6e40c9", borderRadius: "6px", padding: "4px 8px" }}>
          <span style={{ color: "#a78bfa", fontWeight: "bold", fontSize: "14px", marginLeft: "4px", userSelect: "none" }}>$</span>
          <textarea
            rows={text.split("\n").length > 3 ? 3 : 1}
            style={{ flex: 1, padding: "10px 4px", border: "none", background: "transparent", color: "#C9D1D9", outline: "none", fontFamily: "'Fira Code', monospace", fontSize: "14px", resize: "none", overflowY: "auto" }}
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="type_group_message..."
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
             // Close Icon
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
               <line x1="18" y1="6" x2="6" y2="18"></line>
               <line x1="6" y1="6" x2="18" y2="18"></line>
             </svg>
           ) : (
             // Smile Icon
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <circle cx="12" cy="12" r="10"></circle>
               <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
               <line x1="9" y1="9" x2="9.01" y2="9"></line>
               <line x1="15" y1="9" x2="15.01" y2="9"></line>
             </svg>
           )}
         </button>
         
                     <button 
           onMouseDown={startRecording} 
           onMouseUp={handleVoiceSend}
           className={isRecording ? "rec-pulse" : ""}
           style={{
             background: isRecording ? "#ff333322" : "transparent",
             border: isRecording ? "1px solid #ff3333" : "1px solid #30363D",
             color: isRecording ? "#ff3333" : "#8B949E",
             borderRadius: "4px",
             padding: "8px 10px",
             cursor: "pointer",
             display: "flex",
             alignItems: "center",
             justifyContent: "center",
             transition: "all 0.2s",
             outline: "none"
           }}
           title={isRecording ? "RECORDING_STREAM..." : "START_VOICE_CAPTURE"}
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
             <span style={{ fontSize: "9px", marginLeft: "6px", fontWeight: "bold" }}>
               REC
             </span>
           )}
         </button>
         
                    <button
            onClick={sendMessage}
            style={{ background: "#6e40c922", color: "#a78bfa", border: "1px solid #6e40c9", borderRadius: "4px", padding: "6px 16px", cursor: "pointer", fontFamily: "'Fira Code', monospace", fontSize: "12px", fontWeight: "bold", transition: "all 0.2s" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#6e40c944")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#6e40c922")}
          >
            SEND
          </button>
                   </div>
          
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", padding: "0 4px" }}>
          <span style={{ fontSize: "10px", color: "#484F58" }}>// group_channel: {groupName?.toLowerCase()}</span>
          <span style={{ fontSize: "10px", color: "#484F58" }}>chars: {text.length}</span>
        </div>
      </div>
      <ConfirmModal
      isOpen={!!modalConfig}
      title={modalConfig?.title}
      message={modalConfig?.message || ""}
      variant={modalConfig?.variant}
      onConfirm={() => {
        modalConfig?.onConfirm();
        setModalConfig(null);
      }}
      onCancel={() => setModalConfig(null)}
    />
    </div>
  );
}



