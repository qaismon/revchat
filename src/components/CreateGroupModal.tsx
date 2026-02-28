"use client";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";

interface User {
  _id: string;
  username: string;
  avatar?: string;
}

interface CreateGroupModalProps {
  currentUserId: string;
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}

export default function CreateGroupModal({
  currentUserId,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useSocket(currentUserId);

  useEffect(() => {
    fetch(`/api/users?myId=${currentUserId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data); })
      .catch(console.error);
  }, [currentUserId]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Group name is required"); return; }
    if (selectedIds.length === 0) { setError("Add at least one member"); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), memberIds: selectedIds }),
      });

      if (!res.ok) { setError("Failed to create group"); setLoading(false); return; }

      const group = await res.json();
      socketRef.current?.emit("trigger-group-update", { action: "create", groupId: group._id });
      onGroupCreated(group);
      onClose();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) => u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#0D1117", border: "2px solid #6e40c9", borderRadius: "8px", width: "420px", maxHeight: "80vh", display: "flex", flexDirection: "column", fontFamily: "'Fira Code', monospace", boxShadow: "0 20px 60px rgba(110,64,201,0.3)" }}>
        {/* Header */}
        <div style={{ background: "#161B22", padding: "14px 18px", borderBottom: "1px solid #6e40c9", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px 6px 0 0" }}>
          <span style={{ color: "#a78bfa", fontSize: "13px", fontWeight: "bold" }}>
            👥 CREATE_GROUP_CHANNEL
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px", overflowY: "auto", flex: 1 }}>
          {/* Group name */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "10px", color: "#8B949E", marginBottom: "5px" }}>// GROUP_NAME *</div>
            <input
              autoFocus
              placeholder="e.g. project-review..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", background: "#161B22", border: "1px solid #6e40c9", borderRadius: "4px", color: "#C9D1D9", padding: "8px 10px", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "10px", color: "#8B949E", marginBottom: "5px" }}>// DESCRIPTION (optional)</div>
            <input
              placeholder="What's this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", background: "#161B22", border: "1px solid #30363D", borderRadius: "4px", color: "#C9D1D9", padding: "8px 10px", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Member search */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "10px", color: "#8B949E", marginBottom: "5px" }}>
              // SELECT_MEMBERS * &nbsp;
              {selectedIds.length > 0 && (
                <span style={{ color: "#a78bfa" }}>[{selectedIds.length} selected]</span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#6e40c9", fontSize: "12px" }}>❯</span>
              <input
                placeholder="FILTER_USERS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", background: "#161B22", border: "1px solid #30363D", borderRadius: "4px", color: "#C9D1D9", padding: "7px 7px 7px 28px", fontSize: "12px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* User list */}
          <div style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: "4px", maxHeight: "200px", overflowY: "auto" }}>
            {filteredUsers.length === 0 && (
              <div style={{ padding: "12px", color: "#484F58", fontSize: "12px", textAlign: "center" }}>No users found</div>
            )}
            {filteredUsers.map((u) => {
              const selected = selectedIds.includes(u._id);
              return (
                <div
                  key={u._id}
                  onClick={() => toggleUser(u._id)}
                  style={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", borderBottom: "1px solid #21262d", background: selected ? "#6e40c922" : "transparent", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "#1c1c2e"; }}
                  onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: selected ? "2px solid #6e40c9" : "1px solid #30363D", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", overflow: "hidden", flexShrink: 0 }}>
                    {u.avatar ? <img src={u.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : u.username?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: "13px", color: selected ? "#a78bfa" : "#C9D1D9" }}>
                    {u.username?.toLowerCase()}
                  </div>
                  <div style={{ width: "16px", height: "16px", border: selected ? "none" : "1px solid #30363D", borderRadius: "3px", background: selected ? "#6e40c9" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
                    {selected && "✓"}
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div style={{ marginTop: "10px", color: "#f85149", fontSize: "11px" }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid #30363D", display: "flex", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{ flex: 1, background: "transparent", border: "1px solid #30363D", color: "#8B949E", borderRadius: "4px", padding: "9px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px" }}
          >
            CANCEL
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            style={{ flex: 2, background: loading ? "#6e40c944" : "#6e40c922", border: "1px solid #6e40c9", color: "#a78bfa", borderRadius: "4px", padding: "9px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: "bold", transition: "all 0.2s" }}
          >
            {loading ? "CREATING..." : "CREATE_GROUP"}
          </button>
        </div>
      </div>
    </div>
  );
}
