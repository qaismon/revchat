"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";
import CreateGroupModal from "./CreateGroupModal";
import ConfirmModal from "./ConfirmModal";

interface Group {
  _id: string;
  name: string;
  members: any[];
  admin: any;
}

interface FriendRequest {
  friendshipId: string;
  user: { _id: string; username: string; avatar?: string };
}

interface ChatListProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  onSelect: (id: string) => void;
  onSelectGroup: (group: Group | null) => void;
  selectedUserId?: string;
  selectedGroupId?: string;
  onClearUnread?: (userId: string) => void;
}

export default function ChatList({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onSelect,
  onSelectGroup,
  selectedUserId,
  selectedGroupId,
}: ChatListProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [unreadGroupCounts, setUnreadGroupCounts] = useState<{ [key: string]: number }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"dms" | "groups">("dms");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    message: string;
    title: string;
    variant: "danger" | "info" | "success";
    onConfirm: () => void;
  } | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const searchDebounce = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useSocket(currentUserId);
  const router = useRouter();

  // Memoized Loaders
  const loadFriends = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/users?myId=${currentUserId}`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error("Failed to load friends:", err);
    }
  }, [currentUserId]);

  const loadFriendRequests = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/friends?myId=${currentUserId}`);
      const data = await res.json();
      setIncomingRequests(data.incoming || []);
      setOutgoingRequests(data.outgoing || []);
    } catch (err) {
      console.error("Failed to load requests:", err);
    }
  }, [currentUserId]);

  const loadGroups = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (Array.isArray(data)) setGroups(data);
    } catch (err) {
      console.error("Failed to load groups:", err);
    }
  }, [currentUserId]);

  //read count change when opened from noti
  useEffect(() => {
  if (selectedUserId) {
    setUnreadCounts(p => ({ ...p, [selectedUserId]: 0 }));
  }
}, [selectedUserId]);

  // Initial Load
  useEffect(() => {
    loadFriends();
    loadFriendRequests();
    loadGroups();
  }, [loadFriends, loadFriendRequests, loadGroups]);

  // Search Logic
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    
    if (!searchTerm.trim() || activeTab !== "dms" || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchDebounce.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users?myId=${currentUserId}&search=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data.filter((u: any) => u.isDiscovery));
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchTerm, activeTab, currentUserId]);

  // Socket Logic
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Join group rooms
    groups.forEach((g) => socket.emit("join-group", g._id));

    const handleNewMessage = (m: any) => {
      const sId = String(m.senderId);
      if (sId !== String(selectedUserId)) {
        setUnreadCounts((p) => ({ ...p, [sId]: (p[sId] || 0) + 1 }));
      }
    };

    const handleGroupUpdate = (data: any) => {
      const uid = data?.userId ? String(data.userId) : null;
      const gid = data?.groupId ? String(data.groupId) : null;
      const isMe = uid === String(currentUserId);
      const isSel = gid === String(selectedGroupId);

      if ((data?.action === "exit" && isMe) || data?.action === "delete") {
        setGroups((p) => p.filter((g) => String(g._id) !== gid));
        if (isSel) onSelectGroup(null);
      } else {
        loadGroups();
      }
    };

    const handleGroupMessage = (msg: any) => {
      const gId = String(msg.groupId);
      if (gId !== String(selectedGroupId)) {
        setUnreadGroupCounts((p) => ({ ...p, [gId]: (p[gId] || 0) + 1 }));
      }
    };

    socket.on("receive-message", handleNewMessage);
    socket.on("receive-group-message", handleGroupMessage);
    socket.on("group-updated", handleGroupUpdate);
    socket.on("get-online-users", (ids: string[]) => setOnlineUsers(ids.map(String)));
    socket.on("friend-request-received", loadFriendRequests);
    socket.on("friend-request-updated", () => {
      loadFriends();
      loadFriendRequests();
    });

    return () => {
      socket.off("receive-message", handleNewMessage);
      socket.off("receive-group-message", handleGroupMessage);
      socket.off("group-updated", handleGroupUpdate);
      socket.off("get-online-users");
      socket.off("friend-request-received");
      socket.off("friend-request-updated");
    };
  }, [socketRef.current, selectedUserId, selectedGroupId, currentUserId, groups, loadFriends, loadFriendRequests, loadGroups, onSelectGroup]);

  const handleSoftRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadFriends(), loadFriendRequests(), loadGroups()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleFriendAction = async (targetId: string, action: string) => {
    try {
      await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ myId: currentUserId, targetId, action }),
      });
      if (action === "request") socketRef.current?.emit("friend-request-sent", { to: targetId, from: currentUserId });
      if (action === "accept" || action === "decline") socketRef.current?.emit("friend-request-responded", { to: targetId, action });
      
      await Promise.all([loadFriends(), loadFriendRequests()]);
      setSearchResults([]);
      setSearchTerm("");
    } catch (err) {
      console.error("Action failed", err);
    }
  };

  const handleLogout = () => {
    setModalConfig({
      title: "TERMINATE_SESSION",
      message: "Confirm logout?",
      variant: "danger",
      onConfirm: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        if (socketRef.current) socketRef.current.disconnect();
        window.location.href = "/login";
      },
    });
  };

  // UI Helpers
  const displayedUsers = users
    .filter((u) => u.username?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const ca = unreadCounts[String(a._id)] || 0;
      const cb = unreadCounts[String(b._id)] || 0;
      return ca > 0 && cb === 0 ? -1 : ca === 0 && cb > 0 ? 1 : 0;
    });

  const displayedGroups = groups.filter((g) => g.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalUnreadDMs = Object.entries(unreadCounts).reduce((acc, [id, count]) => (id !== currentUserId ? acc + count : acc), 0);
  const totalUnreadGroups = Object.values(unreadGroupCounts).reduce((a, b) => a + b, 0);
  const isInSearch = searchTerm.trim().length >= 2 && activeTab === "dms";

  return (
    <div className="flex flex-col h-full bg-[#07090d] border-r border-[#1a1f2e] font-mono text-[#C9D1D9] overflow-hidden select-none">
      <style>{`
        .cl-scroll::-webkit-scrollbar{width:3px}.cl-scroll::-webkit-scrollbar-track{background:transparent}.cl-scroll::-webkit-scrollbar-thumb{background:#1e2535;border-radius:10px}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spinning{animation:spin 0.7s linear infinite}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.4}}.pulse-online{animation:pulse-dot 2s ease-in-out infinite}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp 0.15s ease-out}
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3.5 border-b border-[#111520] bg-[#07090d] shrink-0">
        <div className="text-[9px] text-[#2d3440] tracking-wide border border-[#1a1f2e] px-1.5 py-0.5 rounded whitespace-nowrap">RevChat v1.1</div>
        <div className="relative shrink-0">
          <div onClick={() => router.push("/profile")} className="w-9 h-9 rounded-full border border-[#1a2035] bg-[#0d1117] overflow-hidden flex items-center justify-center cursor-pointer">
            {currentUserAvatar ? <img src={currentUserAvatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[#58A6FF] font-bold text-sm">{currentUserName?.[0]?.toUpperCase()}</span>}
          </div>
          <div className="pulse-online absolute -bottom-px -right-0.5 w-3 h-3 rounded-full bg-[#7EE787] border-2 border-[#07090d]" />
        </div>
        <div className="flex-1 overflow-hidden min-w-0">
          <div onClick={() => router.push("/profile")} className="text-xs text-[#a0a3a5] font-semibold truncate cursor-pointer">{currentUserName?.toUpperCase()}</div>
        </div>
        <button onClick={() => setShowRequests(!showRequests)} title="Friend Requests"
          className={`relative p-2 rounded-lg transition-colors shrink-0 ${showRequests ? "text-[#58A6FF] bg-[#0d1829]" : "text-[#484F58]"}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {incomingRequests.length > 0 && (
            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-[#f85149] text-white text-[8px] font-bold rounded-full flex items-center justify-center">{incomingRequests.length}</span>
          )}
        </button>
      </div>

      {/* Friend Requests Panel */}
      {showRequests && (
        <div className="fade-up bg-[#0a0d14] border-b border-[#111520] px-3 py-2.5 max-h-60 overflow-y-auto shrink-0">
          <div className="text-[9px] text-[#484F58] tracking-widest mb-2">// FRIEND_REQUESTS</div>
          {incomingRequests.length === 0 && outgoingRequests.length === 0 && <div className="text-[11px] text-[#2d3440] text-center py-1.5">no pending requests</div>}
          {incomingRequests.length > 0 && <>
            <div className="text-[9px] text-[#2d3440] tracking-widest mb-1.5">INCOMING</div>
            {incomingRequests.map(({ friendshipId, user }) => (
              <div key={friendshipId} className="flex items-center gap-2 py-2 border-b border-[#111520]">
                <div className="w-7 h-7 rounded-lg bg-[#0d1117] border border-[#1a1f2e] overflow-hidden flex items-center justify-center shrink-0">
                  {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[#58A6FF] text-[10px] font-bold">{user.username?.[0]?.toUpperCase()}</span>}
                </div>
                <span className="flex-1 text-xs text-[#C9D1D9] truncate">{user.username?.toLowerCase()}</span>
                <button onClick={() => handleFriendAction(String(user._id), "accept")} className="bg-[#0d2a1a] border border-[#238636] text-[#7EE787] rounded px-2 py-1 text-[9px] cursor-pointer active:scale-95 transition-transform shrink-0">ACCEPT</button>
                <button onClick={() => handleFriendAction(String(user._id), "decline")} className="bg-transparent border border-[#3a1a1a] text-[#f85149] rounded px-2 py-1 text-[9px] cursor-pointer active:scale-95 transition-transform shrink-0">DECLINE</button>
              </div>
            ))}
          </>}
          {outgoingRequests.length > 0 && <>
            <div className="text-[9px] text-[#2d3440] tracking-widest mt-2 mb-1.5">OUTGOING</div>
            {outgoingRequests.map(({ friendshipId, user }) => (
              <div key={friendshipId} className="flex items-center gap-2 py-2 border-b border-[#111520]">
                <div className="w-7 h-7 rounded-lg bg-[#0d1117] border border-[#1a1f2e] overflow-hidden flex items-center justify-center shrink-0">
                  {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[#484F58] text-[10px] font-bold">{user.username?.[0]?.toUpperCase()}</span>}
                </div>
                <span className="flex-1 text-xs text-[#8B949E] truncate">{user.username?.toLowerCase()}</span>
                <span className="text-[9px] text-[#484F58] tracking-wide shrink-0">PENDING</span>
                <button onClick={() => handleFriendAction(String(user._id), "cancel")} className="bg-transparent border border-[#1a1f2e] text-[#484F58] rounded px-2 py-1 text-[9px] cursor-pointer active:scale-95 transition-transform shrink-0">CANCEL</button>
              </div>
            ))}
          </>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-[#07090d] border-b border-[#111520] px-2 shrink-0">
        {(["dms", "groups"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const accent = tab === "dms" ? "#58A6FF" : "#a78bfa";
          const unread = tab === "dms" ? totalUnreadDMs : totalUnreadGroups;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-mono tracking-[1.5px] uppercase transition-colors"
              style={{ color: isActive ? accent : "#3d4452", background: "transparent", border: "none", borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent" }}>
              {tab === "dms" ? "Direct" : "Groups"}
              {unread > 0 && <span className="px-1.5 py-px rounded text-[9px] font-bold" style={{ background: tab === "dms" ? "#1a3a6e" : "#2d1a5e", color: accent }}>{unread}</span>}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-2.5 py-2 bg-[#07090d] shrink-0">
        <div className="relative flex items-center">
          <svg className="absolute left-2.5 text-[#2d3440]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder={activeTab === "dms" ? "search friends or find new..." : "search groups..."}
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-6 py-2 border border-[#111520] rounded-lg bg-[#0d1117] text-[#8B949E] outline-none text-[11px] font-mono focus:border-[#2a3550] transition-colors" />
          {isSearching && <svg className="spinning absolute right-2.5 text-[#2d3440]" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
        </div>
      </div>

      {/* List */}
      <div className="cl-scroll flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5">
  {/* DMs */}
        {activeTab === "dms" && !isInSearch && displayedUsers.map(user => {
          const uid = String(user._id);
          const isSel = String(selectedUserId) === uid;
          const isOnline = onlineUsers.includes(uid);
          const unread = unreadCounts[uid] || 0;
          return (
            <div key={uid} onClick={() => { setUnreadCounts(p => ({ ...p, [uid]: 0 })); onSelect(uid); }}
              className={`flex items-center gap-2.5 px-2.5 py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${isSel ? "bg-[#0d1829] border border-[#1a3a6e] border-l-2 border-l-[#58A6FF]" : "bg-transparent border border-transparent hover:bg-[#0a0d14]"}`}>
              <div className="relative shrink-0">
                <div className={`w-10 h-10 rounded-xl border bg-[#0d1117] overflow-hidden flex items-center justify-center ${isSel ? "border-[#1a3a6e]" : "border-[#1a1f2e]"}`}>
                  {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <span className={`font-bold text-sm ${isSel ? "text-[#58A6FF]" : "text-[#3d4452]"}`}>{user.username?.[0]?.toUpperCase()}</span>}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#07090d] ${isOnline ? "bg-[#7EE787] shadow-[0_0_6px_rgba(126,231,135,0.5)]" : "bg-[#1e2535]"}`} />
              </div>
              <div className="flex-1 overflow-hidden min-w-0">
                <div className={`text-sm truncate ${isSel ? "text-[#8fb8f0]" : "text-[#cdd3db]"} ${unread > 0 ? "font-semibold" : "font-normal"}`}>{user.username?.toLowerCase()}</div>
              </div>
              {unread > 0 && <div className="bg-[#1a3a6e] text-[#58A6FF] min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-md flex items-center justify-center shrink-0">{unread}</div>}
            </div>
          );
        })}


        {/* Discovery */}
        {isInSearch && searchResults.length > 0 && activeTab === "dms" && (
          <div className="fade-up">
            <div className="text-[9px] text-[#2d3440] tracking-widest px-0.5 py-1.5">// DISCOVER_USERS</div>
            {searchResults.map(user => (
              <div key={user._id} className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg border border-[#111520] mb-0.5">
                <div className="w-9 h-9 rounded-xl border border-[#1a1f2e] bg-[#0d1117] overflow-hidden flex items-center justify-center shrink-0">
                  {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[#484F58] font-bold text-xs">{user.username?.[0]?.toUpperCase()}</span>}
                </div>
                <span className="flex-1 text-xs text-[#8B949E] truncate">{user.username?.toLowerCase()}</span>
                <button onClick={() => handleFriendAction(user._id, "request")} className="bg-[#0d1f2d] border border-[#1a3a6e] text-[#58A6FF] rounded px-2.5 py-1.5 text-[9px] cursor-pointer tracking-wide shrink-0 active:scale-95 transition-transform">+ ADD</button>
              </div>
            ))}
            <div className="text-[9px] text-[#1e2535] px-0.5 py-1">-- end of results --</div>
          </div>
        )}
        {isInSearch && !isSearching && searchResults.length === 0 && activeTab === "dms" && <div className="text-center text-[#1e2535] text-[11px] py-4">no users found</div>}

      
        {/* Groups */}
        {activeTab === "groups" && <>
          {displayedGroups.map(group => {
            const isSel = String(selectedGroupId) === String(group._id);
            const unread = unreadGroupCounts[group._id] || 0;
            return (
              <div key={group._id} onClick={() => onSelectGroup(group)}
                className={`flex items-center gap-2.5 px-2.5 py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${isSel ? "bg-[#110d1f] border border-[#2d1a5e] border-l-2 border-l-[#a78bfa]" : "bg-transparent border border-transparent hover:bg-[#0a0a10]"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 border ${isSel ? "bg-[#1a1030] border-[#2d1a5e]" : "bg-[#0d0d18] border-[#1a1f2e]"}`}>👥</div>
                <div className="flex-1 overflow-hidden min-w-0">
                  <div className={`text-sm truncate ${isSel ? "text-[#c4aaff]" : "text-[#9aa3b0]"} ${unread > 0 ? "font-semibold" : ""}`}>{group.name?.toLowerCase()}</div>
                  <div className="text-[10px] text-[#2d3440] mt-0.5">{group.members?.length} members</div>
                </div>
                {unread > 0 && <div className="bg-[#2d1a5e] text-[#a78bfa] min-w-[20px] h-5 px-1.5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0">{unread}</div>}
              </div>
            );
          })}
          <button onClick={() => setShowCreateGroup(true)} className="mt-1.5 w-full py-3 bg-transparent border border-dashed border-[#1a1f2e] rounded-xl text-[#2d3440] text-[10px] tracking-widest flex items-center justify-center gap-1.5 hover:border-[#a78bfa] hover:text-[#a78bfa] hover:bg-[#0a0a10] active:scale-[0.98] transition-all cursor-pointer">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            NEW_GROUP
          </button>
        </>}

        {/* Empty states */}
        {activeTab === "dms" && !isInSearch && displayedUsers.length === 0 && (
          <div className="text-center text-[#1e2535] text-[11px] mt-12 tracking-wide">
            <div className="text-2xl mb-2 opacity-30">◎</div>
            <div>no friends yet</div>
            <div className="mt-1.5 text-[10px] text-[#1a1f2e]">search a username to add someone</div>
          </div>
        )}
        {activeTab === "groups" && displayedGroups.length === 0 && (
          <div className="text-center text-[#1e2535] text-[11px] mt-12 tracking-wide"><div className="text-2xl mb-2 opacity-30">◎</div>no groups yet</div>
        )}
      </div>

      {/* Utility bar */}
      <div className="flex items-center gap-1 px-2.5 py-2.5 border-t border-[#111520] bg-[#07090d] shrink-0">
        <button onClick={() => router.push("/profile")} title="Profile" className="p-2.5 rounded-lg text-[#484F58] hover:bg-[#161B22] hover:text-[#58A6FF] transition-colors active:scale-95">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
        {activeTab === "dms" && (
          <button onClick={handleSoftRefresh} disabled={isRefreshing} title="Refresh" className="p-2.5 rounded-lg text-[#484F58] hover:bg-[#161B22] hover:text-[#C9D1D9] transition-colors active:scale-95 disabled:opacity-40">
            <svg className={isRefreshing ? "spinning" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        )}
        <div className="flex-1" />
        <button onClick={handleLogout} title="Logout" className="p-2.5 rounded-lg text-[#484F58] hover:bg-[#2d1a1a] hover:text-[#F85149] transition-colors active:scale-95">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>

      {showCreateGroup && <CreateGroupModal currentUserId={currentUserId} onClose={() => setShowCreateGroup(false)} onGroupCreated={g => { setGroups(p => [g, ...p]); setActiveTab("groups"); onSelectGroup(g); }} />}
      <ConfirmModal isOpen={!!modalConfig} title={modalConfig?.title} message={modalConfig?.message || ""} variant={modalConfig?.variant} onConfirm={() => { modalConfig?.onConfirm(); setModalConfig(null); }} onCancel={() => setModalConfig(null)} />
    </div>
  );
}