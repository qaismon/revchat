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
  const [activeSection, setActiveSection] = useState<"username" | "password" | "delete" | "keys" | null>(null);
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
    <div className="min-h-screen bg-[#07090c] flex flex-col font-mono text-[#C9D1D9] relative overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none opacity-30 z-0" 
           style={{ backgroundImage: "radial-gradient(circle, #1a2335 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_30%_40%,#0d182920_0%,transparent_60%)]" />

      <main className="relative z-10 w-full max-w-4xl mx-auto px-6 py-10 md:py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-12">
          <button 
            className="flex items-center gap-2 px-4 py-2 text-[11px] text-[#9db0d8] border border-[#9db0d8] rounded-md hover:border-[#1a3a6e] hover:text-[#58A6FF] transition-all"
            onClick={() => router.push("/chat")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            RETURN_TO_CHATS
          </button>
          <div className="text-[9px] text-[#1e2d42] tracking-[2px] hidden sm:block">USER_SETTINGS</div>
        </div>

        {/* Layout Grid */}
        <div className="flex flex-col md:flex-row gap-10 items-start">
          
          {/* Left Column: Identity */}
          <aside className="w-full md:w-[240px] flex flex-col items-center gap-6 md:sticky md:top-24">
            <label 
              className="relative cursor-pointer group"
              onMouseEnter={() => setAvatarHovered(true)}
              onMouseLeave={() => setAvatarHovered(false)}
            >
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl border border-[#1a2a4a] bg-[#0d1117] overflow-hidden flex items-center justify-center relative shadow-[0_0_24px_rgba(88,166,255,0.08)] group-hover:shadow-[0_0_40px_rgba(88,166,255,0.16)] transition-all duration-500">
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl text-[#1a3a6e] font-bold">{userName?.[0]?.toUpperCase()}</span>
                )}
                
                {/* Overlay */}
                <div className={`absolute inset-0 bg-[#07090c]/80 flex flex-col items-center justify-center gap-1 transition-opacity duration-200 ${avatarHovered || isBusy ? 'opacity-100' : 'opacity-0'}`}>
                  {isBusy ? (
                    <svg className="animate-spin text-[#58A6FF]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <>
                      <svg className="text-[#58A6FF]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <span className="text-[9px] text-[#58A6FF] tracking-wider">UPLOAD</span>
                    </>
                  )}
                </div>
              </div>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>

            <div className="text-center w-full">
              <h1 className="text-lg font-semibold text-[#C9D1D9] lowercase">{userName}</h1>
              <p className="text-[10px] text-[#2d3440] break-all">{email}</p>
            </div>

            <div className="flex items-center gap-2 bg-[#0a0d14] border border-[#0d1a0d] rounded-full px-4 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1cd82b] shadow-[0_0_8px_rgba(28,216,43,0.6)]" />
              <span className="text-[9px] text-[#4bfc4b] tracking-widest uppercase">Online</span>
            </div>
          </aside>

          {/* Right Column: Forms */}
          <section className="flex-1 w-full space-y-3">
            <h2 className="text-xl font-bold text-[#58A6FF] tracking-tight mb-4">Account Settings</h2>

            {/* Email (Immutable) */}
            <div className="bg-[#0a0d14] border border-[#111520] rounded-xl p-4 flex items-center gap-4">
              <svg className="text-[#1e2d42] shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <div className="flex-1 min-w-0">
                <label className="text-[9px] text-[#3f5472] tracking-widest block mb-0.5 uppercase">E-mail Address</label>
                <div className="text-sm text-[#d2d9e2] truncate">{email || "FETCHING..."}</div>
              </div>
              <span className="text-[8px] text-[#1a2030] border border-[#111520] px-2 py-0.5 rounded uppercase font-bold">Immutable</span>
            </div>

            {/* Username Section */}
            <div className="bg-[#0a0d14] border border-[#111520] rounded-xl overflow-hidden group">
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-[#0d1017] transition-colors text-left"
                onClick={() => setActiveSection(activeSection === "username" ? null : "username")}
              >
                <div className="flex items-center gap-4">
                  <svg className="text-[#1e2d42]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <div>
                    <label className="text-[9px] text-[#3f5472] tracking-widest block mb-0.5 uppercase">Username</label>
                    <div className="text-sm text-[#d2d9e2] lowercase">{userName}</div>
                  </div>
                </div>
                <svg className={`text-[#1e2d42] transition-transform duration-200 ${activeSection === 'username' ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              
              {activeSection === "username" && (
                <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="h-px bg-[#0d1017] -mx-4 mb-3" />
                  <input 
                    className="w-full bg-[#07090c] border border-[#1a1f2e] focus:border-[#2a3a5a] text-[#C9D1D9] text-sm p-3 rounded-md outline-none transition-colors"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="enter new username"
                  />
                  <button 
                    className="w-full bg-[#0d1829] border border-[#1a3a6e] text-[#58A6FF] text-[11px] font-bold py-3 rounded-md hover:bg-[#1a3a6e] disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
                    onClick={handleNameUpdate}
                    disabled={isBusy || newUserName.trim() === userName.trim()}
                  >
                    {loading ? "Committing..." : "Commit_Name_Change"}
                  </button>
                </div>
              )}
            </div>

            {/* Password Section */}
            <div className="bg-[#0a0d14] border border-[#111520] rounded-xl overflow-hidden">
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-[#0d1017] transition-colors text-left"
                onClick={() => setActiveSection(activeSection === "password" ? null : "password")}
              >
                <div className="flex items-center gap-4">
                  <svg className="text-[#1e2d42]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <div>
                    <label className="text-[9px] text-[#3f5472] tracking-widest block mb-0.5 uppercase">Security Protocol</label>
                    <div className="text-sm text-[#d2d9e2] tracking-[3px]">••••••••</div>
                  </div>
                </div>
                <svg className={`text-[#1e2d42] transition-transform duration-200 ${activeSection === 'password' ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              
              {activeSection === "password" && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="h-px bg-[#0d1017] -mx-4 mb-3" />
                  <div className="relative">
                    <input 
                      type={showCurrentPw ? "text" : "password"}
                      className="w-full bg-[#07090c] border border-[#1a1f2e] focus:border-[#2a3a5a] text-[#C9D1D9] text-sm p-3 rounded-md outline-none pr-10"
                      placeholder="current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2d3440] hover:text-[#8B949E]">
                      {showCurrentPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type={showNewPw ? "text" : "password"}
                      className="w-full bg-[#07090c] border border-[#1a1f2e] focus:border-[#2a3a5a] text-[#C9D1D9] text-sm p-3 rounded-md outline-none pr-10"
                      placeholder="new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2d3440] hover:text-[#8B949E]">
                      {showNewPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  <button 
                    className="w-full border border-[#2d1a1a] text-[#F85149] text-[11px] font-bold py-3 rounded-md hover:bg-[#2d1a1a] disabled:opacity-30 transition-all uppercase tracking-widest"
                    onClick={handlePasswordUpdate}
                    disabled={isBusy || !currentPassword || !newPassword}
                  >
                    {loading ? "Committing..." : "Change_Password"}
                  </button>
                </div>
              )}
            </div>

            {/* Key Management */}
            <div className="pt-6">
              <div className="flex items-center gap-2 text-[#58A6FF] text-[9px] tracking-[2px] mb-3 uppercase font-bold">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Key_Management
              </div>

              <div className="bg-[#0a0d14] border border-[#111520] rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-[#0d1017] transition-colors text-left"
                  onClick={() => setActiveSection(activeSection === "keys" ? null : "keys")}
                >
                  <div className="flex items-center gap-4">
                    <svg className="text-[#1e2d42]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                    <div>
                      <label className="text-[9px] text-[#3f5472] tracking-widest block mb-0.5 uppercase">Encryption Keys</label>
                      <div className="text-[12px] text-[#8B949E]">Export or restore your E2EE keys</div>
                    </div>
                  </div>
                  <svg className={`text-[#1e2d42] transition-transform duration-200 ${activeSection === 'keys' ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {activeSection === "keys" && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="h-px bg-[#0d1017] -mx-4 mb-3" />
                    <p className="text-[10px] text-[#8B949E] leading-relaxed">
                      Export your private key for safekeeping. If you lose access, import it back to recover old messages.
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 bg-[#0d1829] border border-[#1a3a6e] text-[#58A6FF] text-[11px] font-bold py-3 rounded-md hover:bg-[#1a3a6e] transition-all uppercase tracking-widest"
                        onClick={() => {
                          const pk = localStorage.getItem(`privKey_${userId}`);
                          if (!pk) {
                            setModalConfig({ title: "NO_KEY", message: "No private key found in localStorage.", variant: "info", onConfirm: () => {} });
                            return;
                          }
                          const blob = new Blob([pk], { type: "application/octet-stream" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `revchat-privkey-${userId}.key`;
                          a.click();
                          URL.revokeObjectURL(url);
                          setModalConfig({ title: "KEY_EXPORTED", message: "Private key downloaded. Store it securely — anyone with this file can read your messages.", variant: "success", onConfirm: () => {} });
                        }}
                      >
                        EXPORT_KEY
                      </button>
                      <button
                        className="flex-1 bg-[#0d1829] border border-[#1a3a6e] text-[#58A6FF] text-[11px] font-bold py-3 rounded-md hover:bg-[#1a3a6e] transition-all uppercase tracking-widest relative"
                      >
                        IMPORT_KEY
                        <input
                          type="file"
                          accept=".key"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const text = await file.text();
                              localStorage.setItem(`privKey_${userId}`, text);
                              // Re-derive and upload matching public key
                              const bytes = atob(text);
                              const buf = new ArrayBuffer(bytes.length);
                              const binaryDer = new Uint8Array(buf);
                              for (let i = 0; i < bytes.length; i++) binaryDer[i] = bytes.charCodeAt(i);
                              const algo = { name: "RSA-OAEP", hash: "SHA-256" };
                              const privKey = await crypto.subtle.importKey("pkcs8", binaryDer, algo, true, ["decrypt"]);
                              // Extract public key via JWK (works cross-browser)
                              const jwk = await crypto.subtle.exportKey("jwk", privKey);
                              const pubJwk = { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RSA-OAEP-256", ext: true };
                              const pubKey = await crypto.subtle.importKey("jwk", pubJwk, algo, true, ["encrypt"]);
                              const pubArrayBuffer = await crypto.subtle.exportKey("spki", pubKey);
                              const pubString = btoa(String.fromCharCode(...new Uint8Array(pubArrayBuffer)));
                              const res = await fetch("/api/users/update-key", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId, publicKey: pubString }),
                              });
                              if (!res.ok) throw new Error("Server rejected public key update");
                              setModalConfig({ title: "KEY_RESTORED", message: "Private key imported and public key re-synced to server. Old messages should now be decryptable.", variant: "success", onConfirm: () => {} });
                            } catch (err: any) {
                              setModalConfig({ title: "IMPORT_FAILED", message: `ERROR: ${err.message || "Invalid key file."}`, variant: "danger", onConfirm: () => {} });
                            }
                            e.target.value = "";
                          }}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-6">
              <div className="flex items-center gap-2 text-[#ff0000] text-[9px] tracking-[2px] mb-3 uppercase font-bold">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                Danger_Zone
              </div>

              <div className={`bg-[#080508] border border-[#180a0a] rounded-xl overflow-hidden transition-all duration-1000 ${activeSection === 'delete' ? 'ring-1 ring-red-900/50 shadow-[0_0_20px_rgba(248,81,73,0.1)]' : ''}`}>
                <button 
                  className="w-full flex items-center justify-between p-4 hover:bg-[#0d0508] transition-colors text-left"
                  onClick={() => { setActiveSection(activeSection === "delete" ? null : "delete"); setDeleteConfirmText(""); }}
                >
                  <div className="flex items-center gap-4">
                    <svg className="text-[#c40707]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    <div>
                      <label className="text-[9px] text-[#ff0404] tracking-widest block mb-0.5 uppercase">Delete Account</label>
                      <div className="text-[12px] text-[#fc0101]">Permanently purge all data</div>
                    </div>
                  </div>
                  <svg className={`text-[#3d1a1a] transition-transform duration-200 ${activeSection === 'delete' ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {activeSection === "delete" && (
                  <div className="px-4 pb-4 space-y-4">
                    <div className="h-px bg-[#180a0a] -mx-4 mb-3" />
                    
                    <div className="bg-[#0d0508] border border-[#1a0a0a] rounded-lg p-3 space-y-2">
                      {[
                        "Your user account will be permanently deleted",
                        "All messages and groups will be erased",
                        "Your avatar will be purged from CDN",
                        "This action cannot be undone",
                      ].map((warning, i) => (
                        <div key={i} className="flex gap-2 text-[11px] text-[#a80202] leading-relaxed">
                          <span className="text-[#b60202] shrink-0 font-bold">✕</span>
                          {warning}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] text-[#c50505] tracking-tight">
                        Type <span className="text-red-600 font-bold">DELETE</span> to confirm
                      </div>
                      <input 
                        className="w-full bg-[#0d0508] border border-[#2d1a1a] focus:border-[#5a1a1a] text-[#F85149] text-sm p-3 rounded-md outline-none tracking-widest"
                        placeholder="type DELETE here"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                        maxLength={6}
                      />
                    </div>

                    <button 
                      className="w-full bg-[#1a0808] border border-[#f80505] text-[#fd170b] text-[11px] font-bold py-3 rounded-md hover:bg-[#3a0f0f] hover:border-[#ff2b20] disabled:opacity-30 transition-all uppercase tracking-widest shadow-red-900/10 shadow-lg"
                      onClick={handleDeleteAccount}
                      disabled={!deleteReady || isBusy}
                    >
                      {isDeleting ? "Purging..." : deleteReady ? "Confirm_Permanent_Deletion" : "Type DELETE to unlock"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      </main>

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

// Simple Icon Components for clean code
const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);

const EyeOffIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
);