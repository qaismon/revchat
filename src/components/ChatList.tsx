"use client";
import { useEffect, useState, useRef } from "react";
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

export default function ChatList({ currentUserId, currentUserName, currentUserAvatar, onSelect, onSelectGroup, selectedUserId, selectedGroupId }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [unreadGroupCounts, setUnreadGroupCounts] = useState<{ [key: string]: number }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"dms" | "groups">("dms");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ message: string; title: string; variant: "danger" | "info" | "success"; onConfirm: () => void; } | null>(null);

  // Friend system state
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounce = useRef<NodeJS.Timeout | null>(null);

  const socketRef = useSocket(currentUserId);
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFriends = async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/users?myId=${currentUserId}`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) { console.error("Fetch friends error:", err); }
  };

  const loadFriendRequests = async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/friends?myId=${currentUserId}`);
      const data = await res.json();
      setIncomingRequests(data.incoming || []);
      setOutgoingRequests(data.outgoing || []);
    } catch (err) { console.error("Fetch requests error:", err); }
  };

  const loadGroups = () => {
    if (!currentUserId) return;
    fetch("/api/groups")
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setGroups(data); })
      .catch(err => console.error("Groups fetch error:", err));
  };

  useEffect(() => {
    loadFriends();
    loadFriendRequests();
    loadGroups();
  }, [currentUserId]);

  // Search for users to add (discovery)
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchTerm.trim() || activeTab !== "dms") { setSearchResults([]); return; }
    if (searchTerm.trim().length < 2) { setSearchResults([]); return; }

    searchDebounce.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users?myId=${currentUserId}&search=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        if (Array.isArray(data)) setSearchResults(data.filter((u: any) => u.isDiscovery));
        else setSearchResults([]);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 400);
  }, [searchTerm, activeTab, currentUserId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || groups.length === 0) return;
    groups.forEach(g => socket.emit("join-group", g._id));
  }, [socketRef.current, groups]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewMessage = (newMessage: any) => {
      const sId = String(newMessage.senderId);
      if (sId !== String(selectedUserId)) {
        setUnreadCounts(prev => ({ ...prev, [sId]: (prev[sId] || 0) + 1 }));
      }
    };

    const handleGroupUpdate = (data: any) => {
      const incomingUserId = data?.userId ? String(data.userId) : null;
      const incomingGroupId = data?.groupId ? String(data.groupId) : null;
      const isMe = incomingUserId === String(currentUserId);
      const isSelectedGroup = incomingGroupId === String(selectedGroupId);
      if (data?.action === "exit" && isMe) { setGroups(prev => prev.filter(g => String(g._id) !== incomingGroupId)); if (isSelectedGroup) onSelectGroup(null); }
      else if (data?.action === "delete") { setGroups(prev => prev.filter(g => String(g._id) !== incomingGroupId)); if (isSelectedGroup) onSelectGroup(null); }
      else { loadGroups(); }
    };

    const handleGroupMessage = (msg: any) => {
      const gId = String(msg.groupId);
      if (gId !== String(selectedGroupId)) setUnreadGroupCounts(prev => ({ ...prev, [gId]: (prev[gId] || 0) + 1 }));
    };

    socket.on("receive-message", handleNewMessage);
    socket.on("receive-group-message", handleGroupMessage);
    socket.on("group-updated", handleGroupUpdate);
    socket.on("get-online-users", (ids: string[]) => setOnlineUsers(ids.map(id => String(id))));

    return () => {
      socket.off("receive-message", handleNewMessage);
      socket.off("receive-group-message", handleGroupMessage);
      socket.off("group-updated", handleGroupUpdate);
      socket.off("get-online-users");
    };
  }, [socketRef.current, selectedUserId, selectedGroupId, currentUserId]);

  const handleSoftRefresh = async () => {
    setIsRefreshing(true);
    try { await Promise.all([loadFriends(), loadFriendRequests(), loadGroups()]); }
    catch (err) { console.error("Refresh failed:", err); }
    finally { setTimeout(() => setIsRefreshing(false), 500); }
  };

  const handleFriendAction = async (targetId: string, action: string) => {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ myId: currentUserId, targetId, action }),
    });
    await Promise.all([loadFriends(), loadFriendRequests()]);
    setSearchResults([]);
    setSearchTerm("");
  };

  const handleLogout = () => {
    setModalConfig({
      title: "TERMINATE_SESSION", message: "Confirm logout?", variant: "danger",
      onConfirm: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        if (socketRef.current) socketRef.current.disconnect();
        window.location.href = "/login";
      }
    });
  };

  const displayedUsers = users
    .filter(u => u.username?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const countA = unreadCounts[String(a._id)] || 0;
      const countB = unreadCounts[String(b._id)] || 0;
      if (countA > 0 && countB === 0) return -1;
      if (countA === 0 && countB > 0) return 1;
      return 0;
    });

  const displayedGroups = groups.filter(g => g.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalUnreadDMs = Object.entries(unreadCounts).reduce((acc, [id, count]) => id !== currentUserId ? acc + count : acc, 0);
  const totalUnreadGroups = Object.values(unreadGroupCounts).reduce((a, b) => a + b, 0);
  const isInSearch = searchTerm.trim().length >= 2 && activeTab === "dms";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#07090d", borderRight: "1px solid #1a1f2e", fontFamily: "'Fira Code', 'Courier New', monospace", color: "#C9D1D9", overflow: "hidden" }}>
      <style>{`
        .cl-scroll::-webkit-scrollbar { width: 3px; }
        .cl-scroll::-webkit-scrollbar-track { background: transparent; }
        .cl-scroll::-webkit-scrollbar-thumb { background: #1e2535; border-radius: 10px; }
        .cl-item { transition: all 0.2s ease; }
        .cl-item:hover { transform: translateX(3px); }
        .cl-tab { transition: all 0.2s ease; position: relative; }
        .cl-util-btn { background: none; border: none; cursor: pointer; padding: 7px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; color: #484F58; }
        .cl-util-btn:hover { background: #161B22; color: #C9D1D9 !important; }
        .cl-util-btn.danger:hover { background: #2d1a1a; color: #F85149 !important; }
        .cl-util-btn.profile:hover { background: #0d1f2d; color: #58A6FF !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spinning { animation: spin 0.7s linear infinite; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .pulse-online { animation: pulse-dot 2s ease-in-out infinite; }
        .search-input::placeholder { color: #2d3440; }
        .search-input:focus { border-color: #2a3550 !important; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.15s ease-out; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #111520", background: "#07090d", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ fontSize: "10px", color: "#2d3440", letterSpacing: "0.5px", border: "1px solid #1a1f2e", padding: "2px 5px", borderRadius: "4px", marginRight: "70px" }}>RevChat v1.1</div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div onClick={() => router.push("/profile")} style={{ width: "34px", height: "34px", borderRadius: "100px", border: "1px solid #1a2035", background: "#0d1117", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {currentUserAvatar
              ? <img src={currentUserAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ color: "#58A6FF", fontWeight: "bold", fontSize: "13px" }}>{currentUserName?.[0]?.toUpperCase()}</span>}
          </div>
          <div className="pulse-online" style={{ position: "absolute", bottom: "-1px", right: "-2px", width: "12px", height: "12px", borderRadius: "50%", background: "#7EE787", border: "2px solid #07090d" }} />
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div onClick={() => router.push("/profile")} style={{ fontSize: "12px", color: "#a0a3a5", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>
            {currentUserName?.toUpperCase()}
          </div>
        </div>
        {/* Friend requests bell */}
        <button onClick={() => setShowRequests(!showRequests)}
          style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: "5px", color: showRequests ? "#58A6FF" : "#484F58", borderRadius: "6px", transition: "all 0.2s", flexShrink: 0 }}
          title="Friend Requests">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {incomingRequests.length > 0 && (
            <span style={{ position: "absolute", top: "0", right: "0", background: "#f85149", color: "#fff", fontSize: "8px", fontWeight: "bold", width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {incomingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Friend Requests Panel */}
      {showRequests && (
        <div className="fade-up" style={{ background: "#0a0d14", borderBottom: "1px solid #111520", padding: "10px 12px", maxHeight: "260px", overflowY: "auto" }}>
          <div style={{ fontSize: "10px", color: "#484F58", letterSpacing: "1px", marginBottom: "8px" }}>// FRIEND_REQUESTS</div>

          {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
            <div style={{ fontSize: "11px", color: "#2d3440", textAlign: "center", padding: "8px 0" }}>no pending requests</div>
          )}

          {/* Incoming */}
          {incomingRequests.length > 0 && (
            <>
              <div style={{ fontSize: "9px", color: "#2d3440", letterSpacing: "1px", marginBottom: "6px" }}>INCOMING</div>
              {incomingRequests.map(({ friendshipId, user }) => (
                <div key={friendshipId} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #111520" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#0d1117", border: "1px solid #1a1f2e", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {user.avatar ? <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ color: "#58A6FF", fontSize: "11px", fontWeight: "bold" }}>{user.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <span style={{ flex: 1, fontSize: "12px", color: "#C9D1D9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username?.toLowerCase()}</span>
                  <button onClick={() => handleFriendAction(String(user._id), "accept")}
                    style={{ background: "#0d2a1a", border: "1px solid #238636", color: "#7EE787", borderRadius: "4px", padding: "3px 8px", fontSize: "9px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.5px" }}>
                    ACCEPT
                  </button>
                  <button onClick={() => handleFriendAction(String(user._id), "decline")}
                    style={{ background: "transparent", border: "1px solid #3a1a1a", color: "#f85149", borderRadius: "4px", padding: "3px 8px", fontSize: "9px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.5px" }}>
                    DECLINE
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Outgoing */}
          {outgoingRequests.length > 0 && (
            <>
              <div style={{ fontSize: "9px", color: "#2d3440", letterSpacing: "1px", margin: "8px 0 6px" }}>OUTGOING</div>
              {outgoingRequests.map(({ friendshipId, user }) => (
                <div key={friendshipId} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #111520" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#0d1117", border: "1px solid #1a1f2e", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {user.avatar ? <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ color: "#484F58", fontSize: "11px", fontWeight: "bold" }}>{user.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <span style={{ flex: 1, fontSize: "12px", color: "#8B949E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username?.toLowerCase()}</span>
                  <span style={{ fontSize: "9px", color: "#484F58", letterSpacing: "0.5px" }}>PENDING</span>
                  <button onClick={() => handleFriendAction(String(user._id), "cancel")}
                    style={{ background: "transparent", border: "1px solid #1a1f2e", color: "#484F58", borderRadius: "4px", padding: "3px 8px", fontSize: "9px", cursor: "pointer", fontFamily: "inherit" }}>
                    CANCEL
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Tab Switcher */}
      <div style={{ display: "flex", background: "#07090d", borderBottom: "1px solid #111520", padding: "0 8px" }}>
        {(["dms", "groups"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const accent = tab === "dms" ? "#58A6FF" : "#a78bfa";
          const unread = tab === "dms" ? totalUnreadDMs : totalUnreadGroups;
          return (
            <button key={tab} className="cl-tab" onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: "10px 4px 9px", background: "transparent", border: "none", borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent", color: isActive ? accent : "#3d4452", cursor: "pointer", fontSize: "10px", fontFamily: "inherit", fontWeight: isActive ? "700" : "400", letterSpacing: "1.5px", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              {tab === "dms" ? "Direct" : "Groups"}
              {unread > 0 && (
                <span style={{ background: tab === "dms" ? "#1a3a6e" : "#2d1a5e", color: accent, padding: "1px 5px", borderRadius: "4px", fontSize: "9px", fontWeight: "bold" }}>{unread}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ padding: "10px 10px 8px", background: "#07090d" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: "10px", color: "#2d3440", flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input className="search-input"
            placeholder={activeTab === "dms" ? "search friends or find new..." : "search groups..."}
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "8px 8px 8px 28px", border: "1px solid #111520", borderRadius: "6px", background: "#0d1117", color: "#8B949E", outline: "none", fontSize: "11px", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color 0.2s" }} />
          {isSearching && (
            <svg className="spinning" style={{ position: "absolute", right: "10px", color: "#2d3440" }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          )}
        </div>
      </div>

      {/* List */}
      <div className="cl-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 8px 8px", display: "flex", flexDirection: "column", gap: "2px" }}>

        {/* Discovery results */}
        {isInSearch && searchResults.length > 0 && activeTab === "dms" && (
          <div className="fade-up">
            <div style={{ fontSize: "9px", color: "#2d3440", letterSpacing: "1px", padding: "4px 2px 6px" }}>// DISCOVER_USERS</div>
            {searchResults.map((user) => (
              <div key={user._id} style={{ padding: "8px 10px", borderRadius: "7px", background: "transparent", display: "flex", gap: "10px", alignItems: "center", border: "1px solid #111520", marginBottom: "2px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #1a1f2e", background: "#0d1117", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {user.avatar ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#484F58", fontWeight: "bold", fontSize: "12px" }}>{user.username?.[0]?.toUpperCase()}</span>}
                </div>
                <span style={{ flex: 1, fontSize: "12px", color: "#8B949E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username?.toLowerCase()}</span>
                <button onClick={() => handleFriendAction(user._id, "request")}
                  style={{ background: "#0d1f2d", border: "1px solid #1a3a6e", color: "#58A6FF", borderRadius: "4px", padding: "3px 8px", fontSize: "9px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.5px", flexShrink: 0 }}>
                  + ADD
                </button>
              </div>
            ))}
            <div style={{ fontSize: "9px", color: "#1e2535", padding: "4px 2px", letterSpacing: "0.5px" }}>-- end of results --</div>
          </div>
        )}

        {/* No discovery results */}
        {isInSearch && !isSearching && searchResults.length === 0 && activeTab === "dms" && (
          <div style={{ textAlign: "center", color: "#1e2535", fontSize: "11px", padding: "16px 0" }}>no users found</div>
        )}

        {/* DM list (friends) — hide when searching */}
        {activeTab === "dms" && !isInSearch && displayedUsers.map((user) => {
          const userIdStr = String(user._id);
          const isSelected = String(selectedUserId) === userIdStr;
          const isOnline = onlineUsers.includes(userIdStr);
          const unreadCount = unreadCounts[userIdStr] || 0;

          return (
            <div key={userIdStr} className="cl-item"
              onClick={() => { setUnreadCounts(prev => ({ ...prev, [userIdStr]: 0 })); onSelect(userIdStr); }}
              style={{ padding: "9px 10px", borderRadius: "7px", background: isSelected ? "#0d1829" : "transparent", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", border: isSelected ? "1px solid #1a3a6e" : "1px solid transparent", borderLeft: isSelected ? "2px solid #58A6FF" : "2px solid transparent" }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#0a0d14"; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "9px", border: `1px solid ${isSelected ? "#1a3a6e" : "#1a1f2e"}`, background: "#0d1117", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {user.avatar ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: isSelected ? "#58A6FF" : "#3d4452", fontWeight: "bold", fontSize: "13px" }}>{user.username?.[0]?.toUpperCase()}</span>}
                </div>
                <div style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "11px", height: "11px", borderRadius: "50%", background: isOnline ? "#7EE787" : "#1e2535", border: "2px solid #07090d", boxShadow: isOnline ? "0 0 6px rgba(126,231,135,0.5)" : "none" }} />
              </div>
              <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                <div style={{ fontSize: "13px", color: isSelected ? "#8fb8f0" : "#cdd3db", fontWeight: unreadCount > 0 ? "600" : "400", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.username?.toLowerCase()}
                </div>
                
              </div>
              {unreadCount > 0 && (
                <div style={{ background: "#1a3a6e", color: "#58A6FF", minWidth: "18px", height: "18px", padding: "0 5px", fontSize: "10px", fontWeight: "bold", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {unreadCount}
                </div>
              )}
            </div>
          );
        })}

        {/* Groups */}
        {activeTab === "groups" && (
          <>
            {displayedGroups.map((group) => {
              const isSelected = String(selectedGroupId) === String(group._id);
              const unreadCount = unreadGroupCounts[group._id] || 0;
              return (
                <div key={group._id} className="cl-item"
                  onClick={() => onSelectGroup(group)}
                  style={{ padding: "9px 10px", borderRadius: "7px", background: isSelected ? "#110d1f" : "transparent", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", border: isSelected ? "1px solid #2d1a5e" : "1px solid transparent", borderLeft: isSelected ? "2px solid #a78bfa" : "2px solid transparent" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#0a0a10"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: isSelected ? "#1a1030" : "#0d0d18", border: `1px solid ${isSelected ? "#2d1a5e" : "#1a1f2e"}`, display: "flex", justifyContent: "center", alignItems: "center", fontSize: "15px", flexShrink: 0 }}>👥</div>
                  <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                    <div style={{ fontSize: "13px", color: isSelected ? "#c4aaff" : "#9aa3b0", fontWeight: unreadCount > 0 ? "600" : "400", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {group.name?.toLowerCase()}
                    </div>
                    <div style={{ fontSize: "10px", color: "#2d3440", marginTop: "1px" }}>{group.members?.length} members</div>
                  </div>
                  {unreadCount > 0 && (
                    <div style={{ background: "#2d1a5e", color: "#a78bfa", minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold", flexShrink: 0 }}>
                      {unreadCount}
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => setShowCreateGroup(true)}
              style={{ marginTop: "6px", width: "100%", padding: "9px", background: "transparent", border: "1px dashed #1a1f2e", borderRadius: "7px", color: "#2d3440", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", letterSpacing: "1px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#a78bfa"; e.currentTarget.style.color = "#a78bfa"; e.currentTarget.style.background = "#0a0a10"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a1f2e"; e.currentTarget.style.color = "#2d3440"; e.currentTarget.style.background = "transparent"; }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              NEW_GROUP
            </button>
          </>
        )}

        {/* Empty states */}
        {activeTab === "dms" && !isInSearch && displayedUsers.length === 0 && (
          <div style={{ textAlign: "center", color: "#1e2535", fontSize: "11px", marginTop: "40px", letterSpacing: "0.5px" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.3 }}>◎</div>
            <div>no friends yet</div>
            <div style={{ marginTop: "6px", color: "#1a1f2e", fontSize: "10px" }}>search a username to add someone</div>
          </div>
        )}
        {activeTab === "groups" && displayedGroups.length === 0 && (
          <div style={{ textAlign: "center", color: "#1e2535", fontSize: "11px", marginTop: "40px", letterSpacing: "0.5px" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.3 }}>◎</div>
            no groups yet
          </div>
        )}
      </div>

      {/* Utility Bar */}
      <div style={{ padding: "8px 10px", borderTop: "1px solid #111520", background: "#07090d", display: "flex", alignItems: "center", gap: "4px" }}>
        <button className="cl-util-btn profile" onClick={() => router.push("/profile")} title="Profile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </button>
        {activeTab === "dms" && (
          <button className="cl-util-btn" onClick={handleSoftRefresh} disabled={isRefreshing} title="Refresh">
            <svg className={isRefreshing ? "spinning" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="cl-util-btn danger" onClick={handleLogout} title="Logout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
        </button>
      </div>

      {showCreateGroup && (
        <CreateGroupModal currentUserId={currentUserId} onClose={() => setShowCreateGroup(false)}
          onGroupCreated={newGroup => { setGroups(prev => [newGroup, ...prev]); setActiveTab("groups"); onSelectGroup(newGroup); }} />
      )}

      <ConfirmModal isOpen={!!modalConfig} title={modalConfig?.title} message={modalConfig?.message || ""} variant={modalConfig?.variant}
        onConfirm={() => { modalConfig?.onConfirm(); setModalConfig(null); }} onCancel={() => setModalConfig(null)} />
    </div>
  );
}