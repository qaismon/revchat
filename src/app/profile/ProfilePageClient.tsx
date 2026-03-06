"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

export default function ProfilePageClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [avatar, setAvatar] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<"username" | "password" | "delete" | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    variant: "danger" | "info" | "success";
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        if (data.avatar) setAvatar(data.avatar);
        if (data.username) { setUserName(data.username); setNewUserName(data.username); }
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
        setModalConfig({ title: "SYNC_SUCCESS", message: `${type.toUpperCase()} modified successfully.`, variant: "success", onConfirm: () => {} });
        return true;
      } else {
        setModalConfig({ title: "WRITE_ERROR", message: `ACCESS_DENIED: ${data.error || "Update protocol failed."}`, variant: "danger", onConfirm: () => {} });
        return false;
      }
    } catch (err) {
      setModalConfig({ title: "CONNECTION_FAILURE", message: "UPLINK_LOST: Server connection error during data commit.", variant: "danger", onConfirm: () => {} });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setModalConfig({ title: "DATA_OVERFLOW", message: "FILE_SIZE_EXCEEDS_LIMIT: Avatar must be under 2MB.", variant: "danger", onConfirm: () => {} });
      return;
    }
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error("Upload failed");
      const success = await triggerUpdate("avatar", data.url);
      if (success) setAvatar(data.url);
    } catch (err) {
      setModalConfig({ title: "UPLOAD_FAILURE", message: "UPLINK_LOST: Avatar upload to CDN failed.", variant: "danger", onConfirm: () => {} });
    } finally {
      setIsUploading(false);
    }
  };

  const handleNameUpdate = async () => {
    const success = await triggerUpdate("username", newUserName);
    if (success) { setUserName(newUserName); setActiveSection(null); }
  };

  const handlePasswordUpdate = async () => {
    const success = await triggerUpdate("password", newPassword, { currentPassword });
    if (success) { setCurrentPassword(""); setNewPassword(""); setActiveSection(null); }
  };

  const handleDeleteAccount = () => {
    // Final confirmation modal before executing
    setModalConfig({
      title: "FINAL_WARNING",
      message: "This will permanently erase your account, all messages, and your avatar from CDN. This cannot be undone. Proceed?",
      variant: "danger",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const res = await fetch("/api/users/delete-account", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          if (res.ok) {
            // Wipe local storage keys belonging to this user
            localStorage.removeItem(`privKey_${userId}`);
            localStorage.removeItem("userId");
            window.location.href = "/login";
          } else {
            const data = await res.json();
            setModalConfig({
              title: "DELETION_FAILED",
              message: `ERROR: ${data.error || "Account purge failed. Try again."}`,
              variant: "danger",
              onConfirm: () => {}
            });
          }
        } catch (err) {
          setModalConfig({ title: "CONNECTION_FAILURE", message: "UPLINK_LOST: Could not reach server.", variant: "danger", onConfirm: () => {} });
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const isBusy = loading || isUploading || isDeleting;
  const deleteReady = deleteConfirmText === "DELETE";

  return (
    <div style={{ minHeight: "100vh", background: "#07090c", display: "flex", fontFamily: "'Fira Code', monospace", color: "#C9D1D9", position: "relative", overflow: "hidden" }}>
      <style>{`
        .pf-input { width: 100%; padding: 11px 14px; border-radius: 6px; border: 1px solid #1a1f2e; background: #07090c; color: #C9D1D9; font-size: 13px; box-sizing: border-box; outline: none; font-family: 'Fira Code', monospace; transition: border-color 0.2s; }
        .pf-input:focus { border-color: #2a3a5a; }
        .pf-input::placeholder { color: #1e2d42; }
        .pf-input:disabled { color: #2d3440; cursor: not-allowed; }
        .pf-btn-primary { width: 100%; padding: 11px; border-radius: 6px; border: 1px solid #1a3a6e; background: #0d1829; color: #58A6FF; font-size: 11px; font-weight: bold; cursor: pointer; font-family: 'Fira Code', monospace; letter-spacing: 1px; transition: all 0.2s; }
        .pf-btn-primary:hover:not(:disabled) { background: #1a3a6e; }
        .pf-btn-primary:disabled { opacity: 0.3; cursor: not-allowed; }
        .pf-btn-danger { width: 100%; padding: 11px; border-radius: 6px; border: 1px solid #2d1a1a; background: transparent; color: #F85149; font-size: 11px; font-weight: bold; cursor: pointer; font-family: 'Fira Code', monospace; letter-spacing: 1px; transition: all 0.2s; }
        .pf-btn-danger:hover:not(:disabled) { background: #2d1a1a; }
        .pf-btn-danger:disabled { opacity: 0.3; cursor: not-allowed; }
        .pf-btn-delete { width: 100%; padding: 11px; border-radius: 6px; border: 1px solid #f80505; background: #1a0808; color: #fd170b; font-size: 11px; font-weight: bold; cursor: pointer; font-family: 'Fira Code', monospace; letter-spacing: 1px; transition: all 0.2s; }
        .pf-btn-delete:hover:not(:disabled) { background: #3a0f0f; border-color: #ff2b20; box-shadow: 0 0 12px rgba(248,81,73,0.2); }
        .pf-btn-delete:disabled { opacity: 0.3; cursor: not-allowed; }
        .pf-section { background: #0a0d14; border: 1px solid #111520; border-radius: 10px; overflow: hidden; transition: border-color 0.2s; }
        .pf-section:hover { border-color: #1a1f2e; }
        .pf-section-danger { background: #080508; border: 1px solid #180a0a; border-radius: 10px; overflow: hidden; transition: border-color 0.2s; }
        .pf-section-danger:hover { border-color: #2d1a1a; }
        .pf-section-header { padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
        .pf-section-header:hover { background: #0d1017; }
        .pf-section-header-danger { padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
        .pf-section-header-danger:hover { background: #0d0508; }
        .pf-section-body { padding: 0 18px 18px; display: flex; flex-direction: column; gap: 10px; }
        .pw-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #2d3440; cursor: pointer; padding: 4px; display: flex; align-items: center; transition: color 0.2s; }
        .pw-toggle:hover { color: #8B949E; }
        .back-btn { background: none; border: 1px solid #111520; border-radius: 6px; color: #565e6b; cursor: pointer; padding: 8px 14px; font-family: 'Fira Code', monospace; font-size: 11px; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .back-btn:hover { border-color: #1a3a6e; color: #58A6FF; }
        .delete-input { width: 100%; padding: 11px 14px; border-radius: 6px; border: 1px solid #2d1a1a; background: #0d0508; color: #F85149; font-size: 13px; box-sizing: border-box; outline: none; font-family: 'Fira Code', monospace; transition: border-color 0.2s; letter-spacing: 2px; }
        .delete-input:focus { border-color: #5a1a1a; }
        .delete-input::placeholder { color: #2d1a1a; letter-spacing: 0; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes slide-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .pf-content { animation: slide-in 0.4s ease forwards; }
        @keyframes avatar-glow { 0%, 100% { box-shadow: 0 0 24px rgba(88,166,255,0.08); } 50% { box-shadow: 0 0 40px rgba(88,166,255,0.16); } }
        .avatar-glow { animation: avatar-glow 4s ease-in-out infinite; }
        @keyframes danger-pulse { 0%, 100% { box-shadow: 0 0 0px rgba(248,81,73,0); } 50% { box-shadow: 0 0 12px rgba(248,81,73,0.15); } }
        .danger-pulse { animation: danger-pulse 3s ease-in-out infinite; }
        .chevron { transition: transform 0.2s ease; color: #1e2d42; }
        .chevron-danger { transition: transform 0.2s ease; color: #3d1a1a; }
      `}</style>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle, #1a2035 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.3, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 30% 40%, #0d182920 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

      <div className="pf-content" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "860px", margin: "0 auto", padding: "40px 24px 80px", display: "flex", flexDirection: "column" }}>

        {/* Top nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "48px" }}>
          <button className="back-btn" onClick={() => router.push("/chat")}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            RETURN_TO_CHATS
          </button>
          <div style={{ fontSize: "9px", color: "#1e2d42", letterSpacing: "2px" }}>USER_SETTINGS</div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "flex", gap: "36px", alignItems: "flex-start" }}>

          {/* Left: Identity card */}
          <div style={{ width: "220px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", position: "sticky", top: "230px" }}>
            <label style={{ cursor: "pointer", display: "block", position: "relative" }}
              onMouseEnter={() => setAvatarHovered(true)}
              onMouseLeave={() => setAvatarHovered(false)}>
              <div className="avatar-glow" style={{ width: "110px", height: "110px", borderRadius: "20px", border: "1px solid #1a2a4a", background: "#0d1117", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {avatar
                  ? <img src={avatar} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: "38px", color: "#1a3a6e", fontWeight: "bold" }}>{userName?.[0]?.toUpperCase()}</span>
                }
                <div style={{ position: "absolute", inset: 0, background: "rgba(7,9,12,0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", opacity: (avatarHovered || isBusy) ? 1 : 0, transition: "opacity 0.2s" }}>
                  {isBusy
                    ? <svg className="spinning" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    : <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <span style={{ fontSize: "9px", color: "#58A6FF", letterSpacing: "1.5px" }}>UPLOAD</span>
                      </>
                  }
                </div>
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarChange} style={{ display: "none" }} />
            </label>

            <div style={{ textAlign: "center", width: "100%" }}>
              <div style={{ fontSize: "15px", color: "#C9D1D9", fontWeight: "600", marginBottom: "3px" }}>{userName?.toLowerCase()}</div>
              <div style={{ fontSize: "10px", color: "#2d3440", wordBreak: "break-all" }}>{email}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#0a0d14", border: "1px solid #0d1a0d", borderRadius: "20px", padding: "5px 12px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#1cd82b", boxShadow: "0 0 5px rgba(99,252,112,0.6)" }} />
              <span style={{ fontSize: "9px", color: "#4bfc4b", letterSpacing: "1px" }}>ONLINE</span>
            </div>

          
          </div>

          {/* Right: Settings panels */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
            <div style={{ fontSize: "18px", color: "#58A6FF", fontWeight: "600", marginBottom: "12px", letterSpacing: "-0.3px" }}>
              Account Settings
            </div>

            {/* Email */}
            <div className="pf-section">
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e2d42" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "9px", color: "#3f5472", letterSpacing: "1.5px", marginBottom: "3px" }}>E-MAIL ADDRESS</div>
                  <div style={{ fontSize: "13px", color: "#d2d9e2" }}>{email || "FETCHING..."}</div>
                </div>
                <span style={{ fontSize: "9px", color: "#1a2030", border: "1px solid #111520", padding: "2px 7px", borderRadius: "4px", letterSpacing: "0.5px" }}>IMMUTABLE</span>
              </div>
            </div>

            {/* Username */}
            <div className="pf-section">
              <div className="pf-section-header" onClick={() => setActiveSection(activeSection === "username" ? null : "username")}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e2d42" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <div>
                    <div style={{ fontSize: "9px", color: "#3f5472", letterSpacing: "1.5px", marginBottom: "3px" }}>USERNAME</div>
                    <div style={{ fontSize: "13px", color: "#d2d9e2" }}>{userName?.toLowerCase()}</div>
                  </div>
                </div>
                <svg className="chevron" style={{ transform: activeSection === "username" ? "rotate(180deg)" : "rotate(0deg)" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {activeSection === "username" && (
                <div className="pf-section-body">
                  <div style={{ height: "1px", background: "#0d1017", margin: "0 0 4px" }} />
                  <input className="pf-input" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="enter new username" />
                  <button className="pf-btn-primary" onClick={handleNameUpdate} disabled={isBusy || newUserName.trim() === userName.trim()}>
                    {loading ? "COMMITTING..." : "COMMIT_NAME_CHANGE"}
                  </button>
                </div>
              )}
            </div>

            {/* Password */}
            <div className="pf-section">
              <div className="pf-section-header" onClick={() => setActiveSection(activeSection === "password" ? null : "password")}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e2d42" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <div>
                    <div style={{ fontSize: "9px", color: "#3f5472", letterSpacing: "1.5px", marginBottom: "3px" }}>SECURITY_PROTOCOL</div>
                    <div style={{ fontSize: "13px", color: "#d2d9e2", letterSpacing: "2px" }}>••••••••</div>
                  </div>
                </div>
                <svg className="chevron" style={{ transform: activeSection === "password" ? "rotate(180deg)" : "rotate(0deg)" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {activeSection === "password" && (
                <div className="pf-section-body">
                  <div style={{ height: "1px", background: "#0d1017", margin: "0 0 4px" }} />
                  <div style={{ position: "relative" }}>
                    <input className="pf-input" type={showCurrentPw ? "text" : "password"} placeholder="current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ paddingRight: "42px" }} />
                    <button className="pw-toggle" type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                      {showCurrentPw
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input className="pf-input" type={showNewPw ? "text" : "password"} placeholder="new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ paddingRight: "42px" }} />
                    <button className="pw-toggle" type="button" onClick={() => setShowNewPw(!showNewPw)}>
                      {showNewPw
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  <button className="pf-btn-danger" onClick={handlePasswordUpdate} disabled={isBusy || !currentPassword || !newPassword}>
                    {loading ? "COMMITTING..." : "CHANGE_PASSWORD"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Danger Zone ── */}
            <div style={{ marginTop: "8px" }}>
              <div style={{ fontSize: "9px", color: "#ff0000", letterSpacing: "2px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                DANGER_ZONE
              </div>

              <div className={`pf-section-danger ${activeSection === "delete" ? "danger-pulse" : ""}`}>
                <div className="pf-section-header-danger" onClick={() => { setActiveSection(activeSection === "delete" ? null : "delete"); setDeleteConfirmText(""); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c40707" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    <div>
                      <div style={{ fontSize: "9px", color: "#ff0404", letterSpacing: "1.5px", marginBottom: "3px" }}>DELETE_ACCOUNT</div>
                      <div style={{ fontSize: "12px", color: "#fc0101" }}>Permanently purge all data</div>
                    </div>
                  </div>
                  <svg className="chevron-danger" style={{ transform: activeSection === "delete" ? "rotate(180deg)" : "rotate(0deg)" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </div>

                {activeSection === "delete" && (
                  <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ height: "1px", background: "#180a0a", marginBottom: "4px" }} />

                    {/* Warning checklist */}
                    <div style={{ background: "#0d0508", border: "1px solid #1a0a0a", borderRadius: "6px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "7px" }}>
                      {[
                        "Your user account will be permanently deleted",
                        "All messages sent and received will be erased",
                        "Your avatar will be purged from CDN",
                        "You will be removed from all groups",
                        "Groups you admin will be deleted",
                        "This action cannot be undone",
                      ].map((warning, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <span style={{ color: "#b60202", fontSize: "10px", marginTop: "1px", flexShrink: 0 }}>✕</span>
                          <span style={{ fontSize: "11px", color: "#a80202", lineHeight: "1.5" }}>{warning}</span>
                        </div>
                      ))}
                    </div>

                    {/* Confirm input */}
                    <div>
                      <div style={{ fontSize: "10px", color: "#c50505", marginBottom: "6px", letterSpacing: "0.5px" }}>
                        Type <span style={{ color: "#ff0d00", fontWeight: "bold" }}>DELETE</span> to confirm
                      </div>
                      <input
                        className="delete-input"
                        placeholder="type DELETE here"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                        maxLength={6}
                      />
                    </div>

                    <button
                      className="pf-btn-delete"
                      onClick={handleDeleteAccount}
                      disabled={!deleteReady || isBusy}
                    >
                      {isDeleting
                        ? "PURGING_ACCOUNT..."
                        : deleteReady
                          ? "CONFIRM_PERMANENT_DELETION"
                          : "TYPE DELETE TO UNLOCK"
                      }
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

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