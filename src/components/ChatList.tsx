"use client";
import { useEffect, useState } from "react";
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

export default function ChatList({ currentUserId, currentUserName, currentUserAvatar, onSelect, onSelectGroup, selectedUserId, selectedGroupId }: any) {
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

  const socketRef = useSocket(currentUserId);
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSoftRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadGroups(),
        fetch(`/api/users?myId=${currentUserId}`)
          .then((res) => res.json())
          .then((data) => { if (Array.isArray(data)) setUsers(data); })
      ]);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    if (!currentUserId) return;
    fetch(`/api/users?myId=${currentUserId}`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data); })
      .catch(err => console.error("Fetch error:", err));
  }, [currentUserId]);

  const loadGroups = () => {
    if (!currentUserId) return;
    fetch("/api/groups")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setGroups(data); })
      .catch(err => console.error("Groups fetch error:", err));
  };

  useEffect(() => { loadGroups(); }, [currentUserId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || groups.length === 0) return;
    groups.forEach((g) => socket.emit("join-group", g._id));
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

      if (data?.action === "exit" && isMe) {
        setGroups((prev) => prev.filter((g) => String(g._id) !== incomingGroupId));
        if (isSelectedGroup) onSelectGroup(null);
      } else if (data?.action === "delete") {
        setGroups((prev) => prev.filter((g) => String(g._id) !== incomingGroupId));
        if (isSelectedGroup) onSelectGroup(null);
      } else {
        loadGroups();
      }
    };

    const handleGroupMessage = (msg: any) => {
      const gId = String(msg.groupId);
      if (gId !== String(selectedGroupId)) {
        setUnreadGroupCounts(prev => ({ ...prev, [gId]: (prev[gId] || 0) + 1 }));
      }
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

  const handleLogout = () => {
    setModalConfig({
      title: "TERMINATE_SESSION",
      message: "Confirm logout?",
      variant: "danger",
      onConfirm: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        if (socketRef.current) socketRef.current.disconnect();
        window.location.href = "/login";
      }
    });
  };

  const displayedUsers = users
    .filter((u) => u.username?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const countA = unreadCounts[String(a._id)] || 0;
      const countB = unreadCounts[String(b._id)] || 0;
      if (countA > 0 && countB === 0) return -1;
      if (countA === 0 && countB > 0) return 1;
      return 0;
    });

  const displayedGroups = groups.filter((g) =>
    g.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnreadDMs = Object.entries(unreadCounts)
    .reduce((acc, [id, count]) => id !== currentUserId ? acc + count : acc, 0);
  const totalUnreadGroups = Object.values(unreadGroupCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#07090d", borderRight: "1px solid #1a1f2e", fontFamily: "'Fira Code', 'Courier New', monospace", color: "#C9D1D9", overflow: "hidden" }}>
      <style>{`
        .cl-scroll::-webkit-scrollbar { width: 3px; }
        .cl-scroll::-webkit-scrollbar-track { background: transparent; }
        .cl-scroll::-webkit-scrollbar-thumb { background: #1e2535; border-radius: 10px; }
        
        .cl-item { transition: all 0.2s ease; }
        .cl-item:hover { transform: translateX(3px); }

        .cl-tab { transition: all 0.2s ease; position: relative; }

        .cl-util-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 7px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          color: #484F58;
        }
        .cl-util-btn:hover { background: #161B22; color: #C9D1D9 !important; }
        .cl-util-btn.danger:hover { background: #2d1a1a; color: #F85149 !important; }
        .cl-util-btn.profile:hover { background: #0d1f2d; color: #58A6FF !important; }
        .cl-util-btn.newgroup:hover { background: #1a1129; color: #a78bfa !important; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spinning { animation: spin 0.7s linear infinite; }

        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .pulse-online { animation: pulse-dot 2s ease-in-out infinite; }

        .search-input::placeholder { color: #2d3440; }
        .search-input:focus { border-color: #2a3550 !important; }
      `}</style>

      {/* ── Header: current user identity ── */}
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #111520", background: "#07090d", display: "flex", alignItems: "center", gap: "10px"}}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div onClick={() => router.push("/profile")} style={{ width: "34px", height: "34px", borderRadius: "100px", border: "1px solid #1a2035", background: "#0d1117", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor:"pointer"}}>
            {currentUserAvatar
              ? <img src={currentUserAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ color: "#58A6FF", fontWeight: "bold", fontSize: "13px" }}>{currentUserName?.[0]?.toUpperCase()}</span>
            }
          </div>
          {/* Online self-indicator */}
          <div className="pulse-online" style={{ position: "absolute", bottom: "-1px", right: "-2px", width: "12px", height: "12px", borderRadius: "50%", background: "#7EE787", border: "2px solid #07090d" }} />
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div onClick={() => router.push("/profile")} style={{ fontSize: "12px", color: "#a0a3a5", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor:"pointer" }}>
            {currentUserName?.toUpperCase()}
          </div>
          
        </div>
        {/* Version badge */}
        <div style={{ fontSize: "10px", color: "#2d3440", letterSpacing: "0.5px", border: "1px solid #1a1f2e", padding: "2px 5px", borderRadius: "4px" }}>RevChat v1.1</div>
      </div>

      {/* ── Tab Switcher ── */}
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
                <span style={{ background: tab === "dms" ? "#1a3a6e" : "#2d1a5e", color: accent, padding: "1px 5px", borderRadius: "4px", fontSize: "9px", fontWeight: "bold" }}>
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search ── */}
      <div style={{ padding: "10px 10px 8px", background: "#07090d" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: "10px", color: "#2d3440", flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="search-input"
            placeholder={activeTab === "dms" ? "search users..." : "search groups..."}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "8px 8px 8px 28px", border: "1px solid #111520", borderRadius: "6px", background: "#0d1117", color: "#8B949E", outline: "none", fontSize: "11px", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color 0.2s" }}
          />
        </div>
      </div>

      {/* ── List ── */}
      <div className="cl-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 8px 8px", display: "flex", flexDirection: "column", gap: "2px" }}>

        {/* DMs */}
        {activeTab === "dms" && displayedUsers.map((user) => {
          const userIdStr = String(user._id);
          const isSelected = String(selectedUserId) === userIdStr;
          const isOnline = onlineUsers.includes(userIdStr);
          const unreadCount = unreadCounts[userIdStr] || 0;

          return (
            <div key={userIdStr} className="cl-item"
              onClick={() => { setUnreadCounts(prev => ({ ...prev, [userIdStr]: 0 })); onSelect(userIdStr); }}
              style={{ padding: "9px 10px", borderRadius: "7px", background: isSelected ? "#0d1829" : "transparent", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", border: isSelected ? "1px solid #1a3a6e" : "1px solid transparent", borderLeft: isSelected ? "2px solid #58A6FF" : "2px solid transparent" }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#0a0d14"; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "9px", border: `1px solid ${isSelected ? "#1a3a6e" : "#1a1f2e"}`, background: "#0d1117", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {user.avatar
                    ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ color: isSelected ? "#58A6FF" : "#3d4452", fontWeight: "bold", fontSize: "13px" }}>{user.username?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <div style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "11px", height: "11px", borderRadius: "50%", background: isOnline ? "#7EE787" : "#1e2535", border: "2px solid #07090d", boxShadow: isOnline ? "0 0 6px rgba(126,231,135,0.5)" : "none" }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                <div style={{ fontSize: "13px", color: isSelected ? "#8fb8f0" : "#cdd3db", fontWeight: unreadCount > 0 ? "600" : "400", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.username?.toLowerCase()}
                </div>
                {/* Last message preview */}
                {user.lastMessage && (
                  <div style={{ fontSize: "10px", color: "#2d3440", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "1px" }}>
                    {user.lastMessage.substring(0, 30)}...
                  </div>
                )}
              </div>

              {/* Unread badge */}
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
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#0a0a10"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Group icon */}
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: isSelected ? "#1a1030" : "#0d0d18", border: `1px solid ${isSelected ? "#2d1a5e" : "#1a1f2e"}`, display: "flex", justifyContent: "center", alignItems: "center", fontSize: "15px", flexShrink: 0 }}>
                    👥
                  </div>

                  <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                    <div style={{ fontSize: "13px", color: isSelected ? "#c4aaff" : "#9aa3b0", fontWeight: unreadCount > 0 ? "600" : "400", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {group.name?.toLowerCase()}
                    </div>
                    <div style={{ fontSize: "10px", color: "#2d3440", marginTop: "1px" }}>
                      {group.members?.length} members
                    </div>
                  </div>

                  {unreadCount > 0 && (
                    <div style={{ background: "#2d1a5e", color: "#a78bfa", minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold", flexShrink: 0 }}>
                      {unreadCount}
                    </div>
                  )}
                </div>
              );
            })}

            {/* New group button inside list */}
            <button onClick={() => setShowCreateGroup(true)}
              style={{ marginTop: "6px", width: "100%", padding: "9px", background: "transparent", border: "1px dashed #1a1f2e", borderRadius: "7px", color: "#2d3440", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", letterSpacing: "1px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#a78bfa"; e.currentTarget.style.color = "#a78bfa"; e.currentTarget.style.background = "#0a0a10"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1a1f2e"; e.currentTarget.style.color = "#2d3440"; e.currentTarget.style.background = "transparent"; }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              NEW_GROUP
            </button>
          </>
        )}

        {/* Empty states */}
        {activeTab === "dms" && displayedUsers.length === 0 && (
          <div style={{ textAlign: "center", color: "#1e2535", fontSize: "11px", marginTop: "40px", letterSpacing: "0.5px" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.3 }}>◎</div>
            no users found
          </div>
        )}
        {activeTab === "groups" && displayedGroups.length === 0 && (
          <div style={{ textAlign: "center", color: "#1e2535", fontSize: "11px", marginTop: "40px", letterSpacing: "0.5px" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.3 }}>◎</div>
            no groups yet
          </div>
        )}
      </div>

      {/* ── Utility Bar ── */}
      <div style={{ padding: "8px 10px", borderTop: "1px solid #111520", background: "#07090d", display: "flex", alignItems: "center", gap: "4px" }}>

        {/* Profile */}
        <button className="cl-util-btn profile" onClick={() => router.push("/profile")} title="Profile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </button>

        {/* Refresh — DMs only */}
        {activeTab === "dms" && (
          <button className="cl-util-btn" onClick={handleSoftRefresh} disabled={isRefreshing} title="Refresh">
            <svg className={isRefreshing ? "spinning" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Logout */}
        <button className="cl-util-btn danger" onClick={handleLogout} title="Logout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Modals */}
      {showCreateGroup && (
        <CreateGroupModal
          currentUserId={currentUserId}
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={(newGroup) => {
            setGroups((prev) => [newGroup, ...prev]);
            setActiveTab("groups");
            onSelectGroup(newGroup);
          }}
        />
      )}

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