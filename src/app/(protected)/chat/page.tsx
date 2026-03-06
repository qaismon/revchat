"use client";
import { useEffect, useState, useRef } from "react";
import ChatBox from "@/components/ChatBox";
import GroupChatBox from "@/components/GroupChatBox";
import { useRouter } from "next/navigation";
import ChatList from "@/components/ChatList";
import ToastContainer, { Toast } from "@/components/ToastNotifcation";
import { useSocket } from "@/hooks/useSocket";

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<{ _id: string; username: string; avatar?: string } | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<any | null>(null);
  const [time, setTime] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userId, setUserId] = useState<string>("");
  const router = useRouter();

  const socketRef = useSocket(userId);

  // Refs so socket callbacks always see latest values without re-subscribing
  const peerIdRef = useRef<string | null>(null);
  const activeGroupRef = useRef<any | null>(null);
  const usersRef = useRef<any[]>([]);
  const groupsRef = useRef<any[]>([]);

  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("UNAUTHORIZED");
        return res.json();
      })
      .then((user) => {
        if (user?._id) { setCurrentUser(user); setUserId(user._id); }
        else router.push("/login");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // Live clock for empty state
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Preload users + groups into refs so toasts can resolve names/avatars
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users?myId=${userId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) usersRef.current = data; })
      .catch(console.error);
    fetch("/api/groups")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) groupsRef.current = data; })
      .catch(console.error);
  }, [userId]);

  // Notification socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !userId) return;

    const handleDMMessage = (msg: any) => {
      const senderId = String(msg.senderId);
      if (senderId === userId) return;
      if (senderId === peerIdRef.current) return; // chat is open, skip

      const sender = usersRef.current.find(u => String(u._id) === senderId);
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        senderName: sender?.username || "Someone",
        senderAvatar: sender?.avatar,
        message: msg.message || msg.content || "",
        isGroup: false,
        targetId: senderId,
      };
      setToasts(prev => [...prev.slice(-4), newToast]);
    };

    const handleGroupMessage = (msg: any) => {
      const senderId = String(msg.senderId);
      const groupId = String(msg.groupId);
      if (senderId === userId) return;
      if (groupId === String(activeGroupRef.current?._id)) return; // group is open, skip

      const group = groupsRef.current.find(g => String(g._id) === groupId);
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        senderName: msg.senderName || "Someone",
        senderAvatar: msg.senderAvatar,
        message: msg.message || msg.content || "",
        isGroup: true,
        groupName: group?.name || msg.groupName,
        targetId: groupId,
        rawGroup: group,
      };
      setToasts(prev => [...prev.slice(-4), newToast]);
    };

    socket.on("receive-message", handleDMMessage);
    socket.on("receive-group-message", handleGroupMessage);

    return () => {
      socket.off("receive-message", handleDMMessage);
      socket.off("receive-group-message", handleGroupMessage);
    };
  }, [socketRef.current, userId]);

  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const navigateFromToast = (toast: Toast) => {
    if (toast.isGroup) {
      const group = groupsRef.current.find(g => String(g._id) === toast.targetId) || toast.rawGroup;
      if (group) { setActiveGroup(group); setPeerId(null); }
    } else {
      setPeerId(toast.targetId);
      setActiveGroup(null);
    }
  };

  if (!currentUser) {
    return (
      <div style={{ height: "100vh", background: "#07090c", color: "#7EE787", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fira Code', monospace" }}>
        {">"} INITIALIZING_SYSTEM_CORE...
      </div>
    );
  }

  const handleSelectDM = (id: string) => { setPeerId(id); setActiveGroup(null); };
  const handleSelectGroup = (group: any) => { setActiveGroup(group); setPeerId(null); };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "#07090c" }}>
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        .cursor-blink { animation: blink 1.1s step-end infinite; }
        .empty-fadein { animation: fadeInUp 0.5s ease forwards; }
        .float-anim { animation: float 4s ease-in-out infinite; }
      `}</style>

      {/* Toast container — renders on top of everything */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} onNavigate={navigateFromToast} />

      {/* Sidebar */}
      <div style={{ width: "300px", height: "100%", flexShrink: 0 }}>
        <ChatList
          currentUserId={currentUser._id}
          currentUserName={currentUser.username}
          currentUserAvatar={currentUser.avatar || ""}
          onSelect={handleSelectDM}
          onSelectGroup={handleSelectGroup}
          selectedUserId={peerId}
          selectedGroupId={activeGroup?._id}
        />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {peerId ? (
          <ChatBox userId={currentUser._id} peerId={peerId} />
        ) : activeGroup ? (
          <GroupChatBox
            userId={currentUser._id}
            userAvatar={currentUser.avatar || ""}
            userName={currentUser.username}
            groupId={activeGroup._id}
            groupName={activeGroup.name}
            members={activeGroup.members || []}
            isAdmin={String(activeGroup.admin?._id || activeGroup.admin) === String(currentUser._id)}
            onGroupDeleted={() => setActiveGroup(null)}
            onMembersUpdated={(updatedMembers) =>
              setActiveGroup((prev: any) => ({ ...prev, members: updatedMembers }))
            }
          />
        ) : (
          /* ── Empty State ── */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: "#07090c" }}>
            <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: "radial-gradient(circle, #1a2035 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.5 }} />
            <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "radial-gradient(ellipse at center, transparent 30%, #07090c 80%)" }} />

            <div className="empty-fadein" style={{ position: "relative", zIndex: 3, textAlign: "center", fontFamily: "'Fira Code', monospace", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div className="float-anim" style={{ marginBottom: "28px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "16px", border: "1px solid #1a2a4a", background: "linear-gradient(135deg, #0d1829 0%, #0a0d14 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px rgba(88,166,255,0.06), inset 0 1px 0 #1a3a6e33", margin: "0 auto" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
              </div>

              <div style={{ fontSize: "11px", color: "#2d3f5a", letterSpacing: "2px", marginBottom: "10px", textTransform: "uppercase" }}>welcome back</div>
              <div style={{ fontSize: "22px", color: "#58A6FF", fontWeight: "600", letterSpacing: "-0.5px", marginBottom: "6px" }}>
                {currentUser.username?.toLowerCase()}
                <span className="cursor-blink" style={{ color: "#58A6FF", marginLeft: "3px" }}>█</span>
              </div>

              <div style={{ width: "40px", height: "1px", background: "linear-gradient(90deg, transparent, #1a2a4a, transparent)", margin: "18px auto" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "7px", alignItems: "flex-start" }}>
                {[
                  { label: "STATUS", value: "IDLE", color: "#e3b341" },
                  { label: "ENCRYPTION", value: "RSA-OAEP + AES-GCM", color: "#7EE787" },
                  { label: "SESSION", value: "ACTIVE", color: "#7EE787" },
                  { label: "SYS_TIME", value: time, color: "#58A6FF" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "#1e2d42", letterSpacing: "1px", minWidth: "80px" }}>{label}</span>
                    <span style={{ fontSize: "10px", color: "#1e2d42" }}>:</span>
                    <span style={{ fontSize: "10px", color, letterSpacing: "0.5px" }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ width: "40px", height: "1px", background: "linear-gradient(90deg, transparent, #1a2a4a, transparent)", margin: "18px auto" }} />
              <div style={{ fontSize: "11px", color: "#1e2d42", letterSpacing: "1.5px" }}>❯ SELECT_A_CHANNEL_TO_BEGIN</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}