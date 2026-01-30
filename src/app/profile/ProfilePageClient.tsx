"use client";
import { useState, useEffect } from "react";

export default function ProfilePageClient({ userId }: { userId: string }) {
  const [avatar, setAvatar] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  
  // Input states
  const [newUserName, setNewUserName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  // Status states
  const [loading, setLoading] = useState(false);

  // 1. Initial Load
  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        if (data.avatar) setAvatar(data.avatar);
        if (data.username) {
          setUserName(data.username);
          setNewUserName(data.username);
        }
        if (data.email) setEmail(data.email);
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };
    fetchUser();
  }, [userId]);

  // 2. UNIFIED UPDATE LOGIC
  const triggerUpdate = async (type: "avatar" | "username" | "password", value: string, extra = {}) => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, type, value, ...extra }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`${type.charAt(0).toUpperCase() + type.slice(1)} updated!`);
        return true;
      } else {
        alert(data.error || "Update failed");
        return false;
      }
    } catch (err) {
      alert("Server connection error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 3. Specific Handlers
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert("Image too large (Max 2MB)");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result as string;
      const success = await triggerUpdate("avatar", base64);
      if (success) setAvatar(base64);
    };
  };

  const handleNameUpdate = () => triggerUpdate("username", newUserName);

  const handlePasswordUpdate = async () => {
    const success = await triggerUpdate("password", newPassword, { currentPassword });
    if (success) {
      setCurrentPassword("");
      setNewPassword("");
    }
  };

  // 4. Styles
  const inputStyle = {
    width: "100%", padding: "12px", marginTop: "8px", borderRadius: "8px",
    border: "1px solid #ddd", fontSize: "15px", boxSizing: "border-box" as const,
  };

  const btnStyle = {
    width: "100%", padding: "12px", marginTop: "12px", background: "#075e54",
    color: "white", border: "none", borderRadius: "8px", cursor: "pointer", 
    fontWeight: "bold" as const, opacity: loading ? 0.7 : 1
  };

  const sectionCardStyle = {
    marginBottom: "20px", padding: "15px", border: "1px solid #f0f0f0", borderRadius: "10px", background: "white"
  };

  return (
    <div style={{ maxWidth: "450px", margin: "40px auto", padding: "30px", textAlign: "center", fontFamily: "Arial, sans-serif", border: "1px solid #eee", borderRadius: "15px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", background: "white" }}>
      <h2 style={{ color: "#333", marginBottom: "5px" }}>Profile Settings</h2>
      <p style={{ color: "#888", fontSize: "14px", marginBottom: "25px" }}>Manage your account details</p>

      {/* Avatar Section */}
      <div style={{ position: "relative", margin: "0 auto 15px", width: "125px", height: "125px", borderRadius: "50%", background: "#f0f0f0", overflow: "hidden", border: "4px solid #075e54", display: "flex", justifyContent: "center", alignItems: "center" }}>
        {avatar ? (
          <img src={avatar} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: "40px", color: "#ccc" }}>{userName?.[0]?.toUpperCase()}</div>
        )}
        {loading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>Saving...</div>}
      </div>

      <label style={{ color: "#075e54", cursor: "pointer", fontWeight: "bold", fontSize: "14px", display: "block", marginBottom: "30px" }}>
        Change Photo
        <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
      </label>

      <div style={{ textAlign: "left" }}>
        
        {/* Email Display Card (New) */}
        <div style={{ ...sectionCardStyle, background: "#fcfcfc" }}>
          <label style={{ fontSize: "13px", fontWeight: "bold", color: "#666" }}>Email Address</label>
          <div style={{ marginTop: "8px", padding: "12px", borderRadius: "8px", background: "#f0f0f0", color: "#555", fontSize: "15px", border: "1px solid #e0e0e0" }}>
            {email || "Loading..."}
          </div>
          <p style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>Email cannot be changed.</p>
        </div>

        {/* Username Card */}
        <div style={sectionCardStyle}>
          <label style={{ fontSize: "13px", fontWeight: "bold", color: "#666" }}>Display Name</label>
          <input style={inputStyle} value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
          <button style={{ ...btnStyle, background: "#128c7e" }} onClick={handleNameUpdate} disabled={loading}>Update Username</button>
        </div>

        {/* Password Card */}
        <div style={{ ...sectionCardStyle, background: "#f9f9f9" }}>
          <label style={{ fontSize: "13px", fontWeight: "bold", color: "#666" }}>Security</label>
          <input 
            type="password" 
            style={inputStyle} 
            placeholder="Current Password" 
            value={currentPassword} 
            onChange={(e) => setCurrentPassword(e.target.value)} 
          />
          <input 
            type="password" 
            style={inputStyle} 
            placeholder="New Password" 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
          />
          <button 
            style={{ ...btnStyle, background: "#333" }} 
            onClick={handlePasswordUpdate} 
            disabled={loading}
          >
            Change Password
          </button>
        </div>
      </div>

      <button 
        onClick={() => window.location.href = "/chat"} 
        style={{ marginTop: "30px", background: "none", border: "none", color: "#075e54", cursor: "pointer", fontWeight: "bold" }}
      >
        ← Back to Chat
      </button>
    </div>
  );
}