"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import { useUploadThing } from "@/utils/uploadthing";

export default function ProfilePageClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [avatar, setAvatar] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  
  const [newUserName, setNewUserName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    variant: "danger" | "info" | "success";
    onConfirm: () => void;
  } | null>(null);
  const { startUpload, isUploading } = useUploadThing("avatarUploader");

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
        setModalConfig({
          title: "SYNC_SUCCESS",
          message: `${type.toUpperCase()} modified successfully.`,
          variant: "success",
          onConfirm: () => {}
        });
        return true;
      } else {
        setModalConfig({
          title: "WRITE_ERROR",
          message: `ACCESS_DENIED: ${data.error || "Update protocol failed."}`,
          variant: "danger",
          onConfirm: () => {}
        });
        return false;
      }
    } catch (err) {
      setModalConfig({
        title: "CONNECTION_FAILURE",
        message: "UPLINK_LOST: Server connection error during data commit.",
        variant: "danger",
        onConfirm: () => {}
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

 const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);

      const uploaded = await startUpload([file]);
      const avatarUrl = uploaded?.[0]?.url;

      if (!avatarUrl) {
        throw new Error("UPLOADTHING_URL_MISSING");
      }
      
      // triggerUpdate calls your /api/users/update route
      const success = await triggerUpdate("avatar", avatarUrl);
      
      if (success) {
        setAvatar(avatarUrl);
        router.refresh(); 
      }

    } catch (err) {
      console.error("Detailed Upload Error:", err);
      setModalConfig({
        title: "UPLOAD_FAILURE",
        message: "UPLINK_LOST: Avatar upload succeeded but URL sync failed.",
        variant: "danger",
        onConfirm: () => {}
      });
    } finally {
      setLoading(false);
    }
  };
  const handleNameUpdate = async () => {
    const success = await triggerUpdate("username", newUserName);
    if (success) setUserName(newUserName);
  };

  const handlePasswordUpdate = async () => {
    const success = await triggerUpdate("password", newPassword, { currentPassword });
    if (success) {
      setCurrentPassword("");
      setNewPassword("");
    }
  };

  // Styles kept as per your original design
  const inputStyle = {
    width: "100%", padding: "12px", marginTop: "8px", borderRadius: "4px",
    border: "1px solid #30363D", background: "#0D1117", color: "#C9D1D9",
    fontSize: "14px", boxSizing: "border-box" as const, outline: "none",
    fontFamily: "'Fira Code', monospace"
  };
  const btnStyle = {
    width: "100%", padding: "12px", marginTop: "12px", background: "#238636",
    color: "white", border: "none", borderRadius: "4px", cursor: "pointer", 
    fontWeight: "bold" as const, opacity: loading ? 0.7 : 1,
    fontFamily: "'Fira Code', monospace", fontSize: "12px"
  };
  const sectionCardStyle = {
    marginBottom: "20px", padding: "20px", border: "1px solid #30363D", 
    borderRadius: "8px", background: "#161B22"
  };

  return (
    <div style={{ 
      minHeight: "100vh", background: "#07090c", display: "flex", 
      alignItems: "center", justifyContent: "center", padding: "20px",
      fontFamily: "'Fira Code', monospace", color: "#C9D1D9" 
    }}>
      <div style={{ maxWidth: "450px", width: "100%", textAlign: "center" }}>
        
        <h2 style={{ color: "#58A6FF", marginBottom: "5px", fontSize: "20px" }}>{">"} USER_SETTINGS</h2>
        <p style={{ color: "#484F58", fontSize: "12px", marginBottom: "30px" }}>// modify_account_parameters</p>

        <div style={{ 
          position: "relative", margin: "0 auto 15px", width: "120px", height: "120px", 
          borderRadius: "8px", background: "#0D1117", overflow: "hidden", 
          border: "2px solid #58A6FF", display: "flex", justifyContent: "center", alignItems: "center" 
        }}>
          {avatar ? (
            <img src={avatar} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ fontSize: "40px", color: "#30363D" }}>{userName?.[0]?.toUpperCase()}</div>
          )}
          {(loading || isUploading) && (
            <div style={{ 
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", 
              color: "#7EE787", display: "flex", alignItems: "center", 
              justifyContent: "center", fontSize: "10px" 
            }}>
              SYNCING...
            </div>
          )}
        </div>

        <label style={{ color: "#58A6FF", cursor: "pointer", fontSize: "12px", display: "block", marginBottom: "30px" }}>
          [ CHANGE_PROFILE_PHOTO ]
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarChange} style={{ display: "none" }} />
        </label>

        <div style={{ textAlign: "left" }}>
          <div style={sectionCardStyle}>
            <label style={{ fontSize: "11px", color: "#8B949E" }}>// E-MAIL</label>
            <div style={{ marginTop: "8px", padding: "12px", borderRadius: "4px", background: "#0D1117", color: "#484F58", fontSize: "14px", border: "1px solid #21262D" }}>
              {email || "FETCHING..."}
            </div>
          </div>

          <div style={sectionCardStyle}>
            <label style={{ fontSize: "11px", color: "#8B949E" }}>// NAME</label>
            <input style={inputStyle} value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
            <button style={btnStyle} onClick={handleNameUpdate} disabled={loading}>COMMIT_NAME_CHANGE</button>
          </div>

          <div style={sectionCardStyle}>
            <label style={{ fontSize: "11px", color: "#8B949E" }}>// SECURITY_PROTOCOL</label>
            <input type="password" style={inputStyle} placeholder="CURRENT_PASSWORD" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <input type="password" style={inputStyle} placeholder="NEW_PASSWORD" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button style={{ ...btnStyle, background: "#30363D" }} onClick={handlePasswordUpdate} disabled={loading}>CHANGE_PASSWORD</button>
          </div>
        </div>

        <button onClick={() => router.push("/chat")} style={{ marginTop: "20px", background: "none", border: "none", color: "#8B949E", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>
          {`<<`} RETURN_TO_CHATS
        </button>
      </div>

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
