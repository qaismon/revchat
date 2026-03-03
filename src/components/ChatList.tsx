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
    // Run both fetches in parallel
    await Promise.all([
      loadGroups(),
      fetch(`/api/users?myId=${currentUserId}`)
        .then((res) => res.json())
        .then((data) => { if (Array.isArray(data)) setUsers(data); })
    ]);
    console.log("// SYSTEM_SYNC_COMPLETE");
  } catch (err) {
    console.error("Refresh failed:", err);
  } finally {
    // Small delay so the animation is visible
    setTimeout(() => setIsRefreshing(false), 500);
  }
};

  // Load users (for DMs)
  useEffect(() => {
    if (!currentUserId) return;
    fetch(`/api/users?myId=${currentUserId}`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data); })
      .catch(err => console.error("Fetch error:", err));
  }, [currentUserId]);

  // Load groups
  const loadGroups = () => {
    if (!currentUserId) return;
    fetch("/api/groups")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setGroups(data); })
      .catch(err => console.error("Groups fetch error:", err));
  };

  useEffect(() => { loadGroups(); }, [currentUserId]);

  

  // Join all group rooms on socket connection
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || groups.length === 0) return;
    groups.forEach((g) => socket.emit("join-group", g._id));
  }, [socketRef.current, groups]);

  // Socket events
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
  // Use String() on everything to prevent type mismatch (ObjectId vs String)
  const incomingUserId = data?.userId ? String(data.userId) : null;
  const incomingGroupId = data?.groupId ? String(data.groupId) : null;
  
  const isMe = incomingUserId === String(currentUserId);
  const isSelectedGroup = incomingGroupId === String(selectedGroupId);

  console.log("Group Update Received:", data.action, "Is it me?", isMe, "Is it selected?", isSelectedGroup);

  if (data?.action === "exit" && isMe) {
    // 1. Remove from local list
    setGroups((prev) => prev.filter((g) => String(g._id) !== incomingGroupId));
    
    // 2. CLOSE THE CHATBOX
    if (isSelectedGroup) {
      console.log("Closing ChatBox for group:", incomingGroupId);
      onSelectGroup(null); 
    }
  } 
  else if (data?.action === "delete") {
    setGroups((prev) => prev.filter((g) => String(g._id) !== incomingGroupId));
    if (isSelectedGroup) onSelectGroup(null);
  } 
  else {
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
      window.location.href = "/login";    }
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

  const windowStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#090b0f",
    borderRight: "2px solid #30363D",
    fontFamily: "'Fira Code', 'Courier New', monospace",
    color: "#C9D1D9",
    overflow: "hidden"
  };

  return (
    <div style={windowStyle}>
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 6px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: #0D1117; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #30363D; border-radius: 4px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #484F58; }
        .util-btn:hover { color: #58A6FF !important; }
        .logout-btn:hover { color: #F85149 !important; }
        .tab-btn { transition: all 0.2s; }
        .tab-btn:hover { opacity: 1 !important; }
        @keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.refresh-btn.spinning svg {
  animation: spin 0.8s linear infinite;
  color: #58A6FF; /* Turns blue while loading */
}

.refresh-btn:hover:not(.spinning) { 
  color: #fff !important; 
  transform: scale(1.1);
  filter: drop-shadow(0 0 5px #7EE787);

  .sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: #30363D transparent;
}

.sidebar-scroll::-webkit-scrollbar {
  width: 5px;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: #30363D;
  border-radius: 10px;
}

/* Add a subtle fade-in for the whole list */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.sidebar-scroll > div {
  animation: fadeInUp 0.4s ease forwards;
}
}`}</style>

<div style={{ background: "#161B22", padding: "16px", borderBottom: "1px solid #30363D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ display: "flex", alignItems: "center" }}>
    
    <span style={{ fontSize: "10px", fontWeight: "bold", color: "#9ea2a7", letterSpacing: "1px", textTransform: "uppercase" }}>
      RevChat.v1
    </span>
  </div>

  {/* Right Side: Status Indicator */}
  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#7EE787", boxShadow: "0 0 5px #7EE787" }}></div>
</div>

      {/* Tab Switcher */}
      <div style={{ display: "flex", background: "#0D1117", borderBottom: "1px solid #30363D" }}>
        <button
          className="tab-btn"
          onClick={() => setActiveTab("dms")}
          style={{ flex: 1, padding: "9px", background: "transparent", border: "none", borderBottom: activeTab === "dms" ? "2px solid #58A6FF" : "2px solid transparent", color: activeTab === "dms" ? "#58A6FF" : "#8B949E", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", fontWeight: activeTab === "dms" ? "bold" : "normal" }}
        >
          DMs {(() => {
  const totalUnread = Object.entries(unreadCounts)
    .reduce((acc, [id, count]) => {
      // Logic check: Only sum if the ID isn't the current user
      return id !== currentUserId ? acc + count : acc;
    }, 0);

  return totalUnread > 0 ? (
    <span style={{ background: "#238636", color: "white", padding: "0 4px", borderRadius: "8px", fontSize: "9px", marginLeft: "4px" }}>
      {totalUnread}
    </span>
  ) : null;
})()}
        </button>
        <button
          className="tab-btn"
          onClick={() => setActiveTab("groups")}
          style={{ flex: 1, padding: "9px", background: "transparent", border: "none", borderBottom: activeTab === "groups" ? "2px solid #a78bfa" : "2px solid transparent", color: activeTab === "groups" ? "#a78bfa" : "#8B949E", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", fontWeight: activeTab === "groups" ? "bold" : "normal" }}
        >
          Groups {Object.values(unreadGroupCounts).reduce((a, b) => a + b, 0) > 0 && (
            <span style={{ background: "#6e40c9", color: "white", padding: "0 4px", borderRadius: "8px", fontSize: "9px", marginLeft: "4px" }}>
              {Object.values(unreadGroupCounts).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "12px", background: "#0D1117", borderBottom: "1px solid #21262d" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: "10px", color: activeTab === "dms" ? "#58A6FF" : "#a78bfa", fontSize: "12px" }}>❯</span>
          <input
            placeholder={activeTab === "dms" ? "FILTER_ID..." : "FILTER_GROUP..."}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "8px 8px 8px 25px", border: `1px solid ${activeTab === "dms" ? "#30363D" : "#6e40c944"}`, borderRadius: "4px", background: "#161B22", color: "#C9D1D9", outline: "none", fontSize: "12px", fontFamily: "inherit" }}
          />
        </div>
      </div>

      {/* List */}
      <div className="sidebar-scroll" style={{ 
  flex: 1, 
  overflowY: "auto", 
  padding: "10px", // Breathing room
  display: "flex",
  flexDirection: "column",
  gap: "4px" // Separation between "cards"
}}>

  {/* DMs Tab */}
  {activeTab === "dms" && displayedUsers.map((user) => {
    const userIdStr = String(user._id);
    const isSelected = String(selectedUserId) === userIdStr;
    const isOnline = onlineUsers.includes(userIdStr);
    const unreadCount = unreadCounts[userIdStr] || 0;

    return (
      <div
        key={userIdStr}
        onClick={() => {
          setUnreadCounts(prev => ({ ...prev, [userIdStr]: 0 }));
          onSelect(userIdStr);
        }}
        style={{ 
          padding: "14px 14px", 
          borderRadius: "8px",
          background: isSelected ? "rgba(88, 166, 255, 0.1)" : "transparent", 
          cursor: "pointer", 
          display: "flex", 
          gap: "14px", 
          alignItems: "center", 
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          border: isSelected ? "1px solid rgba(88, 166, 255, 0.4)" : "1px solid transparent",
          position: "relative",
          overflow: "hidden"
        }}
        onMouseEnter={(e) => { 
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = "#161B22";
            e.currentTarget.style.transform = "translateX(6px)";
          }
        }}
        onMouseLeave={(e) => { 
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.transform = "translateX(0px)";
          }
        }}
      >

        {/* Avatar with Integrated Status Dot */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ 
            width: "38px", height: "38px", borderRadius: "10px", 
            border: isSelected ? "2px solid #58A6FF" : "1px solid #30363D", 
            background: "#0D1117", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {user.avatar ? (
              <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: isSelected ? "#58A6FF" : "#8B949E", fontWeight: "bold" }}>{user.username?.[0].toUpperCase()}</span>
            )}
          </div>
          <div style={{ 
            position: "absolute", bottom: "-2px", right: "-2px", 
            width: "12px", height: "12px", borderRadius: "50%", 
            background: isOnline ? "#7EE787" : "#484F58", 
            border: "2px solid #0d1117",
            boxShadow: isOnline ? "0 0 8px rgba(126, 231, 135, 0.4)" : "none"
          }} />
        </div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ 
            fontWeight: unreadCount > 0 || isSelected ? "600" : "400", 
            fontSize: "14px", color: isSelected ? "#8f8e8e" : "#C9D1D9", 
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            display: "flex", alignItems: "center", gap: "6px"
          }}>
            {user.username?.toLowerCase()}
            {unreadCount > 0 && <span style={{ color: "#7EE787", fontSize: "6px", fontWeight: "bold" }}>●</span>}
          </div>
          <div style={{ fontSize: "9px", color: isOnline ? "#7EE787" : "#484F58", letterSpacing: "0.5px" }}>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </div>
        </div>

        {unreadCount > 0 && (
          <div style={{ 
            background: "#238636", color: "white", minWidth: "20px", height: "20px", 
            padding: "0 6px", fontSize: "11px", fontWeight: "bold", 
            borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {unreadCount}
          </div>
        )}
      </div>
    );
  })}

  {/* Groups Tab (Purple Theme) */}
  {activeTab === "groups" && displayedGroups.map((group) => {
    const isSelected = String(selectedGroupId) === String(group._id);
    const unreadCount = unreadGroupCounts[group._id] || 0;
    
    return (
      <div
        key={group._id}
        onClick={() => onSelectGroup(group)}
        style={{ 
          padding: "10px 14px", borderRadius: "8px",
          background: isSelected ? "rgba(167, 139, 250, 0.1)" : "transparent", 
          cursor: "pointer", display: "flex", gap: "14px", alignItems: "center",
          transition: "all 0.25s ease",
          border: isSelected ? "1px solid rgba(167, 139, 250, 0.4)" : "1px solid transparent"
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#161B22"; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <div style={{ 
          width: "38px", height: "38px", borderRadius: "50%", 
          background: isSelected ? "#a78bfa" : "#30363D", 
          display: "flex", justifyContent: "center", alignItems: "center", fontSize: "16px"
        }}>
          <span style={{ filter: isSelected ? "brightness(0) invert(1)" : "none" }}>👥</span>
        </div>
        
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontWeight: isSelected ? "600" : "400", fontSize: "14px", color: isSelected ? "#fff" : "#C9D1D9" }}>
            {group.name?.toLowerCase()}
          </div>
          <div style={{ fontSize: "10px", color: "#8B949E" }}>
            {group.members?.length} members
          </div>
        </div>
        
        {unreadCount > 0 && (
          <div style={{ background: "#a78bfa", color: "#000", minWidth: "20px", height: "20px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold" }}>
            {unreadCount}
          </div>
        )}
      </div>
    );
  })}
</div>
      {/* Utility Bar */}
<div style={{ padding: "10px 10px", borderTop: "1px solid #30363D", background: "#161B22", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
    

  <button onClick={() => router.push("/profile")} className="util-btn" style={{ background: "none", border: "none", color: "#58A6FF", fontSize: "11px", fontWeight: "bold", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
    [ PROFILE ]
  </button>

{/* Refresh Icon Button */}


  {activeTab === "groups" && (
    <button
      onClick={() => setShowCreateGroup(true)}
      style={{ background: "none", border: "none", color: "#a78bfa", fontSize: "11px", fontWeight: "bold", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
    >
      [ + NEW_GROUP ]
    </button>
  )}

  <button onClick={handleLogout} className="logout-btn" 
  style={{ background: "none", border: "none", color: "#b91717", fontSize: "11px", fontWeight: "bold", cursor: "pointer", padding: 0, fontFamily: "inherit"}}>
    [ LOG OUT ]
  </button>
  {activeTab!=="groups"&& (<button 
  onClick={handleSoftRefresh} 
  className={`refresh-btn ${isRefreshing ? "spinning" : ""}`}
  disabled={isRefreshing}
  style={{ 
    background: "none", 
    border: "none", 
    color: isRefreshing ? "#fff" : "#7EE787", 
    cursor: isRefreshing ? "default" : "pointer", 
    padding: "4px", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center",
    transition: "all 0.2s ease"
  }}
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"></path>
    <path d="M1 20v-6h6"></path>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
</button>)}
</div>

      {/* Footer */}
      <div style={{ padding: "8px 16px", background: "#0D1117", borderTop: "1px solid #30363D", fontSize: "10px", color: "#484F58", display: "flex", justifyContent: "space-between" }}>
        <span>SYSTEM_STATUS: <span style={{ color: "#7EE787" }}>ACTIVE</span></span>
        <span style={{ opacity: 0.5 }}>v1.1.0</span>
      </div>

      {/* Create Group Modal */}
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
  onConfirm={() => {
    modalConfig?.onConfirm();
    setModalConfig(null);
  }}
  onCancel={() => setModalConfig(null)}
/>
    </div>

    
  );
}