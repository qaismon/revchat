"use client";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Added for redirection

export default function ChatList({ currentUserId, onSelect }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const socketRef = useSocket(currentUserId);
  const router = useRouter(); // Initialize router

  useEffect(() => {
    if (!currentUserId) return;

    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.filter((u: any) => u._id !== currentUserId)));

    fetch(`/api/users/${currentUserId}`)
      .then((res) => res.json())
      .then((data) => setCurrentUserData(data));
  }, [currentUserId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleOnlineUpdate = (userIds: string[]) => {
      setOnlineUsers(userIds);
    };

    socket.on("get-online-users", handleOnlineUpdate);
    return () => {
      socket.off("get-online-users", handleOnlineUpdate);
    };
  }, [socketRef.current]);

  // LOGOUT LOGIC
  const handleLogout = async () => {
    if (confirm("Are you sure you want to logout?")) {
      try {
        // 1. Tell the backend to clear the cookie/session
        const res = await fetch("/api/auth/logout", { method: "POST" });
        
        if (res.ok) {
          // 2. Disconnect socket manually if needed
          socketRef.current?.disconnect();
          // 3. Go to login page
          router.push("/login");
        }
      } catch (err) {
        console.error("Logout failed", err);
        // Fallback: just redirect
        router.push("/login");
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "white", borderRight: "1px solid #eee" }}>
      
      <header style={{ 
        padding: "10px 20px", 
        background: "#075e54", 
        color: "white", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center" 
      }}>
        <span style={{ fontSize: "20px", fontWeight: "bold" }}>Messages</span>
        
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          {/* LOGOUT BUTTON */}
          <button 
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              padding: "6px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
          >
            Logout
          </button>

          {/* PROFILE ICON */}
          <Link href="/profile" style={{ textDecoration: "none" }}>
            <div style={{ 
              width: "38px", 
              height: "38px", 
              borderRadius: "50%", 
              background: "#128c7e", 
              border: "2px solid rgba(255,255,255,0.2)",
              overflow: "hidden", 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center",
              cursor: "pointer",
              transition: "transform 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              {currentUserData?.avatar ? (
                <img src={currentUserData.avatar} alt="Me" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "14px", color: "white" }}>
                  {currentUserData?.username?.[0]?.toUpperCase() || "Me"}
                </span>
              )}
            </div>
          </Link>
        </div>
      </header>
      
      <div style={{ flex: 1, overflowY: "auto" }}>
        {users.map((user) => {
          const isOnline = onlineUsers.includes(user._id);
          return (
            <div
              key={user._id}
              onClick={() => onSelect(user._id)}
              style={{ 
                padding: "15px 20px", 
                borderBottom: "1px solid #f0f0f0", 
                display: "flex", 
                alignItems: "center", 
                gap: "15px",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9f9f9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              <div style={{ position: "relative" }}>
                <div style={{ 
                  width: "45px", 
                  height: "45px", 
                  borderRadius: "50%", 
                  background: "#128c7e", 
                  overflow: "hidden", 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "center", 
                  fontWeight: "bold",
                  color: "white"
                }}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    user.username?.[0]?.toUpperCase() || "?"
                  )}
                </div>

                {isOnline && (
                  <div style={{ 
                    position: "absolute", 
                    bottom: 2, 
                    right: 2, 
                    width: 12, 
                    height: 12, 
                    background: "#25D366", 
                    borderRadius: "50%", 
                    border: "2px solid white" 
                  }} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", fontSize: "16px", color: "#111" }}>
                  {user.username}
                </div>
                <div style={{ 
                  fontSize: "13px", 
                  color: isOnline ? "#25D366" : "#888",
                  fontWeight: isOnline ? "500" : "normal"
                }}>
                  {isOnline ? "online" : "offline"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}