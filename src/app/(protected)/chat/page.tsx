"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import ChatBox from "@/components/ChatBox";
import GroupChatBox from "@/components/GroupChatBox";
import { useRouter } from "next/navigation";
import ChatList from "@/components/ChatList";
import ToastContainer, { Toast } from "@/components/ToastNotifcation";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<{ _id: string; username: string; avatar?: string } | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<any | null>(null);
  const [time, setTime] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  // Socket initialization using the ID from state once loaded
  const socketRef = useSocket(currentUser?._id || "");
  
  // Refs to track current state for socket listeners (avoids stale closures)
  const peerIdRef = useRef<string | null>(null);
  const activeGroupRef = useRef<any | null>(null);
  const usersRef = useRef<any[]>([]);
  const groupsRef = useRef<any[]>([]);

  // Sync refs with state
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);

  // Voice call WebRTC
  const {
    callState, callPeerName, isMuted, callDuration,
    startCall, answerCall, endCall, declineCall, toggleMute,
    handleIncomingCall, handleRemoteAnswer, handleIceCandidate,
    handleRemoteEnded, handleRemoteDeclined, handleRemoteMuted,
  } = useWebRTC(socketRef);

  // 1. Fetch Auth User
  useEffect(() => {
    let isMounted = true;
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("UNAUTHORIZED");
        return res.json();
      })
      .then((user) => {
        if (isMounted) {
          if (user?._id) {
            setCurrentUser(user);
          } else {
            router.push("/login");
          }
        }
      })
      .catch(() => {
        if (isMounted) router.push("/login");
      });
    return () => { isMounted = false; };
  }, [router]);

  // 2. System Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 3. Load Data for Notifications
  useEffect(() => {
    if (!currentUser?._id) return;

    const loadData = async () => {
      try {
        const [uRes, gRes] = await Promise.all([
          fetch(`/api/users?myId=${currentUser._id}`),
          fetch("/api/groups")
        ]);
        const users = await uRes.json();
        const groups = await gRes.json();
        
        if (Array.isArray(users)) usersRef.current = users;
        if (Array.isArray(groups)) groupsRef.current = groups;
      } catch (err) {
        console.error("Failed to sync chat data:", err);
      }
    };

    loadData();
    // Refresh data periodically to keep notification names accurate
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [currentUser?._id]);

  // 4. Socket Message Handlers (Toasts)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !currentUser?._id) return;

    const handleDMMessage = (msg: any) => {
      const senderId = String(msg.senderId);
      // Don't show toast if it's from me or if the chat is currently open
      if (senderId === currentUser._id || senderId === peerIdRef.current) return;

      const sender = usersRef.current.find(u => String(u._id) === senderId);
      
      setToasts(prev => [
        ...prev.slice(-3), // Keep only last 4 toasts
        { 
          id: `toast-${Date.now()}-${Math.random()}`, 
          senderName: sender?.username || "New Message", 
          senderAvatar: sender?.avatar, 
          message: msg.message || msg.content || "Sent a message", 
          isGroup: false, 
          targetId: senderId 
        }
      ]);
    };

    const handleGroupMessage = (msg: any) => {
      const senderId = String(msg.senderId);
      const groupId = String(msg.groupId);

      if (senderId === currentUser._id) return;
      if (groupId === String(activeGroupRef.current?._id)) return;

      const group = groupsRef.current.find(g => String(g._id) === groupId);

      setToasts(prev => [
        ...prev.slice(-3),
        { 
          id: `toast-${Date.now()}-${Math.random()}`, 
          senderName: msg.senderName || "Member", 
          senderAvatar: msg.senderAvatar, 
          message: msg.message || msg.content || "New update", 
          isGroup: true, 
          groupName: group?.name || msg.groupName || "Group Chat", 
          targetId: groupId, 
          rawGroup: group 
        }
      ]);
    };

    socket.on("receive-message", handleDMMessage);
    socket.on("receive-group-message", handleGroupMessage);

    return () => {
      socket.off("receive-message", handleDMMessage);
      socket.off("receive-group-message", handleGroupMessage);
    };
  }, [socketRef, currentUser?._id]);

  // 5. Voice Call Signaling
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Stable wrapper functions for socket.off cleanup
    const onAnswered = (data: { sdp: RTCSessionDescriptionInit }) => handleRemoteAnswer(data.sdp);
    const onIce = (data: { candidate: RTCIceCandidateInit }) => handleIceCandidate(data.candidate);
    const onMuted = (data: { muted: boolean }) => handleRemoteMuted(data.muted);

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", onAnswered);
    socket.on("ice-candidate", onIce);
    socket.on("call-ended", handleRemoteEnded);
    socket.on("call-declined", handleRemoteDeclined);
    socket.on("call-muted", onMuted);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-answered", onAnswered);
      socket.off("ice-candidate", onIce);
      socket.off("call-ended", handleRemoteEnded);
      socket.off("call-declined", handleRemoteDeclined);
      socket.off("call-muted", onMuted);
    };
  }, [socketRef, handleIncomingCall, handleRemoteAnswer, handleIceCandidate, handleRemoteEnded, handleRemoteDeclined, handleRemoteMuted]);

  // Navigation Logic
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleSelectDM = useCallback((id: string) => { 
    setPeerId(id); 
    setActiveGroup(null); 
  }, []);

 const navigateFromToast = useCallback((toast: Toast) => {
  if (toast.isGroup) {
    const group = groupsRef.current.find(g => String(g._id) === toast.targetId) || toast.rawGroup;
    if (group) {
      setActiveGroup(group);
      setPeerId(null);
    }
  } else {
    handleSelectDM(toast.targetId); // ← change this from setPeerId(toast.targetId)
    setActiveGroup(null);
  }
  dismissToast(toast.id);
}, [dismissToast, handleSelectDM]);

  const handleSelectGroup = useCallback((group: any) => { 
    setActiveGroup(group); 
    setPeerId(null); 
  }, []);

  const handleBack = useCallback(() => { 
    setPeerId(null); 
    setActiveGroup(null); 
  }, []);

  if (!currentUser) {
    return (
      <div className="h-screen bg-[#07090c] text-[#7EE787] flex items-center justify-center font-mono text-sm">
        <span className="cursor-blink mr-2">{">"}</span> INITIALIZING_SYSTEM_CORE...
      </div>
    );
  }

  const hasActiveChat = !!(peerId || activeGroup);

  return (
    <div className="flex w-screen h-[100dvh] overflow-hidden bg-[#07090c] selection:bg-[#58A6FF]/30">
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulseGlow { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        .cursor-blink { animation: blink 1.1s step-end infinite; }
        .empty-fadein { animation: fadeInUp 0.5s ease forwards; }
        .float-anim { animation: float 4s ease-in-out infinite; }
        .animate-slideDown { animation: slideDown 0.3s ease-out forwards; }
        .animate-fadeIn { animation: fadeIn 0.25s ease-out forwards; }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} onNavigate={navigateFromToast} />

      <VoiceCallOverlay
        callState={callState}
        callPeerName={callPeerName}
        isMuted={isMuted}
        callDuration={callDuration}
        onAnswer={answerCall}
        onEnd={endCall}
        onDecline={declineCall}
        onToggleMute={toggleMute}
      />

      {/* Sidebar */}
      <div className={`h-full shrink-0 transition-all duration-200 border-r border-[#1a1f2e] ${
        hasActiveChat ? "hidden md:block md:w-[320px]" : "w-full md:w-[320px]"
      }`}>
        <ChatList
          currentUserId={currentUser._id}
          currentUserName={currentUser.username}
          currentUserAvatar={currentUser.avatar || ""}
          onSelect={handleSelectDM}
          onSelectGroup={handleSelectGroup}
          selectedUserId={peerId || undefined}
          selectedGroupId={activeGroup?._id}
        />
      </div>

      {/* Chat Area */}
      <div className={`flex-1 h-full flex flex-col overflow-hidden min-w-0 ${
        hasActiveChat ? "flex" : "hidden md:flex"
      }`}>
        {peerId ? (
          <ChatBox userId={currentUser._id} peerId={peerId} onBack={handleBack} onStartCall={startCall} />
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
            onMembersUpdated={updatedMembers => setActiveGroup((prev: any) => ({ ...prev, members: updatedMembers }))}
            onBack={handleBack}
          />
        ) : (
          /* Empty State Dashboard */
          <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-[#07090c]">
            <div className="absolute inset-0 z-0" style={{ backgroundImage: "radial-gradient(circle, #1a2035 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.4 }} />
            <div className="absolute inset-0 z-[1]" style={{ background: "radial-gradient(ellipse at center, transparent 30%, #07090c 90%)" }} />
            
            <div className="empty-fadein relative z-[3] text-center font-mono flex flex-col items-center px-6">
              <div className="float-anim mb-8">
                <div className="w-20 h-20 rounded-2xl border border-[#1a2a4a] bg-gradient-to-br from-[#0d1829] to-[#0a0d14] flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(88,166,255,0.1)]">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
              </div>
              
              <div className="text-[10px] text-[#2d3f5a] tracking-[3px] mb-3 uppercase opacity-70">terminal connection established</div>
              <div className="text-lg text-[#C9D1D9] font-medium tracking-tight mb-1">
                Welcome, <span className="text-[#58A6FF]">{currentUser.username?.toLowerCase()}</span>
                <span className="cursor-blink text-[#58A6FF] ml-1">_</span>
              </div>
              
              <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#1a2a4a] to-transparent my-6" />
              
              <div className="flex flex-col gap-2 items-start bg-[#0d1117]/50 p-4 rounded-lg border border-[#1a1f2e]">
                {[{ label: "STATUS", value: "ONLINE", color: "#7EE787" }, 
                  { label: "CLOCK", value: time, color: "#58A6FF" },
                  { label: "UPLINK", value: "ENCRYPTED", color: "#a78bfa" }
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex gap-4 items-center">
                    <span className="text-[10px] text-[#484f58] tracking-widest w-16">{label}</span>
                    <span className="text-[10px] text-[#30363d]">:</span>
                    <span className="text-[10px] font-bold tracking-wider" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 text-[11px] text-[#484f58] tracking-[1.5px] animate-pulse">
                ❯ SELECT_A_THREAD_TO_INITIATE_CHAT
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}