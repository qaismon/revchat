"use client";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";

export default function ChatList({ currentUserId, onSelect, selectedUserId }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [searchTerm, setSearchTerm] = useState("");
  
  const socketRef = useSocket(currentUserId);
  const router = useRouter();

  useEffect(() => {
    if (!currentUserId) return;
    fetch(`/api/users?myId=${currentUserId}`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data); })
      .catch(err => console.error("Fetch error:", err));
  }, [currentUserId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handleNewMessage = (newMessage: any) => {
      const sId = String(newMessage.senderId);
      if (sId !== String(selectedUserId)) {
        setUnreadCounts(prev => ({ ...prev, [sId]: (prev[sId] || 0) + 1 }));
      }
    };
    socket.on("receive-message", handleNewMessage);
    socket.on("get-online-users", (ids: string[]) => setOnlineUsers(ids.map(id => String(id))));
    return () => { socket.off("receive-message"); socket.off("get-online-users"); };
  }, [socketRef.current, selectedUserId]);

const handleLogout = async () => {
  if (confirm("TERMINATE SESSION?")) {
    await fetch("/api/auth/logout", { method: "POST" });

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    window.location.href = "/login";
  }
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

  const windowStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#0D1117", 
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
      `}</style>

      {/* Title Bar */}
      <div style={{ background: "#161B22", padding: "16px", borderBottom: "1px solid #30363D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#8B949E", letterSpacing: "1px" }}>RevChat.v1</span>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#238636", boxShadow: "0 0 5px #238636" }}></div>
      </div>

      {/* Search */}
      <div style={{ padding: "12px", background: "#0D1117", borderBottom: "1px solid #21262d" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: "10px", color: "#58A6FF", fontSize: "12px" }}>❯</span>
          <input 
            placeholder="FILTER_ID..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "8px 8px 8px 25px", border: "1px solid #30363D", borderRadius: "4px", background: "#161B22", color: "#C9D1D9", outline: "none", fontSize: "12px", fontFamily: "inherit" }}
          />
        </div>
      </div>

      {/* User List */}
      <div className="sidebar-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {displayedUsers.map((user) => {
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
                padding: "12px 16px", 
                borderLeft: isSelected ? "3px solid #58A6FF" : "3px solid transparent",
                background: isSelected ? "#161B22" : "transparent",
                cursor: "pointer",
                display: "flex", 
                gap: "12px", 
                alignItems: "center",
                borderBottom: "1px solid #21262d",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = "#161B22"; }}
              onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {/* UPDATED: Avatar with PFP support */}
              <div style={{ 
                width: "32px", height: "32px", 
                borderRadius: "4px",
                border: isSelected ? "1px solid #58A6FF" : "1px solid #30363D",
                background: "#0D1117", 
                display: "flex", justifyContent: "center", alignItems: "center",
                fontSize: "14px", fontWeight: "bold",
                color: isOnline ? "#7EE787" : "#484F58",
                flexShrink: 0,
                overflow: "hidden" // Ensures image doesn't bleed out of rounded corners
              }}>
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.username} 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                  />
                ) : (
                  user.username?.[0].toUpperCase()
                )}
              </div>

              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ 
                  fontWeight: unreadCount > 0 || isSelected ? "bold" : "normal", 
                  fontSize: "13px",
                  color: isSelected ? "#58A6FF" : "#C9D1D9",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}>
                  {user.username?.toLowerCase()}{unreadCount > 0 ? " [!]" : ""}
                </div>
                <div style={{ fontSize: "10px", color: isOnline ? "#7EE787" : "#484F58" }}>
                  {isOnline ? "// ONLINE" : "// OFFLINE"}
                </div>
              </div>

              {unreadCount > 0 && (
                <div style={{ background: "#238636", color: "white", padding: "1px 6px", fontSize: "10px", fontWeight: "bold", borderRadius: "10px" }}>
                  {unreadCount}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Utility Bar */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid #30363D", background: "#161B22", display: "flex", gap: "20px" }}>
        <button onClick={() => router.push("/profile")} className="util-btn" style={{ background: "none", border: "none", color: "#58A6FF", fontSize: "11px", fontWeight: "bold", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          [ PROFILE ]
        </button>
        <button onClick={handleLogout} className="logout-btn" style={{ background: "none", border: "none", color: "#b91717", fontSize: "11px", fontWeight: "bold", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          [ TERMINATE_SESSION ]
        </button>
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 16px", background: "#0D1117", borderTop: "1px solid #30363D", fontSize: "10px", color: "#484F58", display: "flex", justifyContent: "space-between" }}>
        <span>SYSTEM_STATUS: <span style={{ color: "#7EE787" }}>ACTIVE</span></span>
        <span style={{ opacity: 0.5 }}>v1.0.4</span>
      </div>
    </div>
  );
}