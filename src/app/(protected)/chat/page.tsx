"use client";
import { useEffect, useState } from "react";
import ChatBox from "@/components/ChatBox";
import GroupChatBox from "@/components/GroupChatBox";
import { useRouter } from "next/navigation";
import ChatList from "@/components/ChatList";

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<{ _id: string; username: string; avatar?: string } | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<any | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("UNAUTHORIZED");
        return res.json();
      })
      .then((user) => {
        if (user?._id) setCurrentUser(user);
        else router.push("/login");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  if (!currentUser) {
    return (
      <div style={{ height: "100vh", background: "#07090c", color: "#7EE787", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fira Code', monospace" }}>
        {">"} INITIALIZING_SYSTEM_CORE...
      </div>
    );
  }

  const handleSelectDM = (id: string) => {
    setPeerId(id);
    setActiveGroup(null);
  };

  const handleSelectGroup = (group: any) => {
    setActiveGroup(group);
    setPeerId(null);
  };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "#07090c" }}>
      {/* Sidebar */}
      <div style={{ width: "300px", height: "100%" }}>
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

      {/* Main Chat Content */}
      <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
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
      
      // 🔥 ADD THIS PROP HERE
      onGroupDeleted={() => {
        console.log("Group deleted or user removed - Closing UI");
        setActiveGroup(null); 
      }}

      onMembersUpdated={(updatedMembers) =>
        setActiveGroup((prev: any) => ({ ...prev, members: updatedMembers }))
      }
    />
  ) : (    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#484F58", fontFamily: "'Fira Code', monospace", fontSize: "14px", textAlign: "center" }}>
            <div>
              <div style={{ color: "#58A6FF", marginBottom: "8px" }}>❯ SESSION_IDLE</div>
              <div style={{ opacity: 0.8 }}>Select a DM or group to begin.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}