"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck, Camera } from "lucide-react";

function b64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(s: string) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function deriveAesKey(password: string, salt: Uint8Array, usage: KeyUsage) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

async function backupPrivateKey(userId: string, privateKeyPem: string, publicKeyPem: string, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(password, salt, "encrypt");
  const payload = JSON.stringify({ privateKey: privateKeyPem, publicKey: publicKeyPem });
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(payload)
  );
  const blob = JSON.stringify({
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(encrypted),
  });
  console.log("📤 Backing up encrypted key pair...");
  const res = await fetch("/api/users/backup-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, encryptedKey: blob }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Backup failed");
  }
  console.log("✅ Encrypted key pair backed up to server");
}

type RestoredKeys = { privateKey: string; publicKey: string } | null;
async function tryRestoreKey(password: string): Promise<RestoredKeys> {
  const res = await fetch("/api/users/backup-key");
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.encryptedKey) return null;

  let parsed: { salt: string; iv: string; ct: string };
  try { parsed = JSON.parse(data.encryptedKey); } catch { return null; }

  try {
    const aesKey = await deriveAesKey(password, fromB64(parsed.salt), "decrypt");
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(parsed.iv) },
      aesKey,
      fromB64(parsed.ct)
    );
    const { privateKey, publicKey } = JSON.parse(new TextDecoder().decode(decrypted));
    if (!privateKey || !publicKey) return null;
    return { privateKey, publicKey };
  } catch {
    return null;
  }
}

async function uploadPublicKey(userId: string, publicKeyPem: string) {
  const res = await fetch("/api/users/update-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, publicKey: publicKeyPem }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Public key re-upload failed");
  }
  console.log("✅ Public key re-uploaded to match restored private key");
}

async function generateAndStoreKeys(userId: string): Promise<string> {
  console.log("🔑 Generating RSA-OAEP key pair...");
  const keys = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  console.log("✅ Key pair generated");

  const exportedPriv = await window.crypto.subtle.exportKey("pkcs8", keys.privateKey);
  const privString = b64(exportedPriv);
  localStorage.setItem(`privKey_${userId}`, privString);
  console.log("💾 Private key saved to localStorage");

  const exportedPub = await window.crypto.subtle.exportKey("spki", keys.publicKey);
  const pubString = b64(exportedPub);

  console.log("📤 Uploading public key to server...");
  const res = await fetch("/api/users/update-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, publicKey: pubString }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    console.error("❌ Server rejected public key update:", res.status, errorData);
    localStorage.removeItem(`privKey_${userId}`);
    throw new Error(errorData.message || "Failed to sync public key");
  }
  console.log("✅ Public key stored on server");
  return pubString;
}

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(""); // stores the UploadThing URL
  const [avatarPreview, setAvatarPreview] = useState(""); // local preview only
  const [error, setError] = useState("");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
const [forgotEmail, setForgotEmail] = useState("");
const [forgotStatus, setForgotStatus] = useState<"idle"|"loading"|"sent">("idle");
const [passwordChanged, setPasswordChanged] = useState(false);

const handleForgotPassword = async () => {
  if (!forgotEmail.trim()) return;
  setForgotStatus("loading");
  await fetch("/api/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: forgotEmail }),
  });
  setForgotStatus("sent");
};

  useEffect(() => {
    fetch("/api/me").then((res) => {
      if (res.ok) router.push("/chat");
    });
  }, [router]);

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    const savedPassword = localStorage.getItem("rememberedPassword");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    if (savedPassword) setPassword(savedPassword);
  }, []);

  // Same pattern as profile page — upload via our own server route using UTApi
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar exceeds 2MB limit.");
      return;
    }

    // Show instant local preview
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUrl("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) throw new Error("Upload failed");

      setAvatarUrl(data.url);
    } catch (err) {
      console.error("Avatar upload error:", err);
      setError("Avatar upload failed. Please try again.");
      setAvatarPreview("");
    } finally {
      setIsUploading(false);
    }
  };

  const passwordStrength = useMemo(() => {
    if (!password) return { label: "", color: "transparent", width: "0%" };
    if (password.length < 6) return { label: "LOW_ENTROPY", color: "#ff4d4d", width: "33%" };
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);
    if (hasLetters && hasNumbers && hasSpecial && password.length >= 8)
      return { label: "HIGH_ENTROPY", color: "#7EE787", width: "100%" };
    if (hasLetters && hasNumbers)
      return { label: "MED_ENTROPY", color: "#ffad33", width: "66%" };
    return { label: "WEAK_HASH", color: "#ff4d4d", width: "33%" };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isUploading) {
      setError("Please wait — avatar is still uploading.");
      return;
    }

    const endpoint = isRegistering ? "/api/register" : "/api/login";
    // avatarUrl is now a CDN URL (or empty string if none chosen)
    const payload = isRegistering
      ? { username, email, password, avatar: avatarUrl }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("userId", data.userId);
        if (rememberMe) localStorage.setItem("rememberedEmail", email);

        const existingKey = localStorage.getItem(`privKey_${data.userId}`);
        if (!existingKey) {
          if (!window.isSecureContext) {
            console.warn("⚠ Not a secure context — crypto.subtle unavailable");
            setError("Secure context required for encryption keys. Use http://localhost:3000 (not IP) or enable HTTPS.");
            return;
          }

          if (passwordChanged) {
            try {
              const newPub = await generateAndStoreKeys(data.userId);
              const newKey = localStorage.getItem(`privKey_${data.userId}`);
              if (newKey) await backupPrivateKey(data.userId, newKey, newPub, password);
              console.log("✅ New encryption key generated and backed up");
            } catch (keyErr) {
              console.error("E2EE Sync Failed:", keyErr);
              setError("Encryption key sync failed — please try again");
              return;
            }
            router.push("/chat");
            return;
          }

          const restored = await tryRestoreKey(password);
          if (restored) {
            localStorage.setItem(`privKey_${data.userId}`, restored.privateKey);
            try {
              await uploadPublicKey(data.userId, restored.publicKey);
              console.log("✅ Public key re-synced from backup");
            } catch (e) {
              console.warn("Public key re-upload failed (old messages may still be visible):", e);
            }
            console.log("✅ Key pair restored from encrypted backup");
          } else {
            const check = await fetch("/api/users/backup-key");
            const checkData = await check.json();
            if (checkData.encryptedKey) {
              setPasswordChanged(true);
              setError("PASSWORD_CHANGED: Your password has changed since the last key backup. Old messages cannot be decrypted. Submit again to generate a new encryption key.");
              return;
            }
            try {
              const newPub = await generateAndStoreKeys(data.userId);
              const newKey = localStorage.getItem(`privKey_${data.userId}`);
              if (newKey) await backupPrivateKey(data.userId, newKey, newPub, password);
              console.log("✅ New encryption key generated and backed up");
            } catch (keyErr) {
              console.error("E2EE Sync Failed:", keyErr);
              setError("Encryption key sync failed — please try again");
              return;
            }
          }
        } else {
          // Key exists locally — ensure it's backed up with public key (migration for pre-backup users)
          try {
            const check = await fetch("/api/users/backup-key");
            const checkData = await check.json();
            if (!checkData.encryptedKey) {
              // Fetch the matching public key from server
              const userRes = await fetch(`/api/users/${data.userId}`);
              const userData = await userRes.json();
              if (userData.publicKey) {
                await backupPrivateKey(data.userId, existingKey, userData.publicKey, password);
                console.log("✅ Existing key pair backed up to server");
              } else {
                console.warn("No public key on server to backup");
              }
            }
          } catch (e) {
            console.warn("Backup check/save failed (non-blocking):", e);
          }
        }
        router.push("/chat");
      } else {
        setError(data.message || "Access Denied: Invalid Credentials");
      }
    } catch (err) {
      console.error("Login fetch error:", err);
      setError("Link Error: Tunnel Connection Failed");
    }
  };

  return (
    <div style={containerStyle}>
      <style>{`
        input::placeholder { color: #484F58; }
        .input-focus:focus { border-color: #58A6FF !important; }
      `}</style>

      <form onSubmit={handleSubmit} style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <div style={{ display: "inline-flex", padding: "12px", background: "#161B22", borderRadius: "50%", border: "1px solid #30363D", marginBottom: "15px" }}>
            <ShieldCheck color="#7EE787" size={32} />
          </div>
          <h2 style={{ color: "#C9D1D9", fontSize: "1.2rem", margin: 0, letterSpacing: "1px" }}>
            {isRegistering ? "CREATE_IDENTITY" : "ESTABLISH_SESSION"}
          </h2>
          <p style={{ color: "#8B949E", fontSize: "11px", marginTop: "5px" }}>
            PROTOCOL: RSA-OAEP-2048 // SHA-256
          </p>
        </div>

        {/* Avatar upload — register only */}
        {isRegistering && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={avatarPreviewStyle}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Camera color="#30363D" size={24} />
              )}
              {isUploading && <div style={uploadingOverlayStyle}>UPLOADING...</div>}
              {/* Green tick when upload is done */}
              {avatarUrl && !isUploading && (
                <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "#238636", borderRadius: "50%", width: "14px", height: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "white" }}>✓</div>
              )}
            </div>
            <label style={{ fontSize: "10px", color: "#58A6FF", cursor: "pointer", textDecoration: "underline" }}>
              [ SET_PROFILE_PICTURE ]
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarChange} style={{ display: "none" }} />
            </label>
          </div>
        )}

        {error && (
          <div style={{ color: "#ff7b72", fontSize: "12px", background: "#ff7b7211", border: "1px solid #ff7b7233", padding: "10px", borderRadius: "4px" }}>
            [!] {error}
          </div>
        )}

        {isRegistering && (
          <div style={inputContainer}>
            <span style={promptStyle}>$</span>
            <input type="text" placeholder="username" className="input-focus" style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
        )}

        <div style={inputContainer}>
          <span style={promptStyle}>$</span>
          <input type="email" placeholder="email_address" className="input-focus" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div style={{ ...inputContainer, position: "relative" }}>
          <span style={promptStyle}>$</span>
          <input type={showPassword ? "text" : "password"} placeholder="password" className="input-focus" style={{ ...inputStyle, paddingRight: "45px" }} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeButtonStyle}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {isRegistering && password && (
          <div style={{ marginTop: "-5px", marginBottom: "5px" }}>
            <div style={{ height: "2px", width: "100%", background: "#30363D", borderRadius: "1px" }}>
              <div style={{ height: "100%", width: passwordStrength.width, background: passwordStrength.color, transition: "width 0.3s ease" }} />
            </div>
            <span style={{ fontSize: "9px", color: passwordStrength.color }}>&gt; STATUS: {passwordStrength.label}</span>
          </div>
        )}

        {!isRegistering && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer", color: "#8B949E" }}>
              <input type="checkbox" style={{ accentColor: "#238636" }} checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Persist email
            </label>
<span
  onClick={() => setShowForgotModal(true)}
  style={{ fontSize: "12px", color: "#58A6FF", cursor: "pointer" }}
>
  forgot_password
</span>          </div>
        )}

        <button type="submit" style={{ ...buttonStyle, opacity: isUploading ? 0.5 : 1, cursor: isUploading ? "not-allowed" : "pointer" }} disabled={isUploading}>
          {isUploading ? "UPLOADING_AVATAR..." : isRegistering ? "REGISTER" : "AUTHENTICATE"}
        </button>

        <p style={{ textAlign: "center", marginTop: "10px", fontSize: "13px", color: "#8B949E" }}>
          {isRegistering ? "Existing user?" : "New user detected?"}{" "}
          <span
            onClick={() => {
              setIsRegistering(!isRegistering);
              setUsername("");
              setPassword("");
              setRememberMe(false);
              setEmail("");
              setAvatarUrl("");
              setAvatarPreview("");
              setPasswordChanged(false);
            }}
            style={{ color: "#7EE787", cursor: "pointer", fontWeight: "bold" }}
          >
            {isRegistering ? "[Login]" : "[Register]"}
          </span>
        </p>
      </form>
      {showForgotModal && (
  <div onClick={() => setShowForgotModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#161B22", border: "1px solid #30363D", borderRadius: "8px", padding: "24px", width: "340px", display: "flex", flexDirection: "column", gap: "16px", fontFamily: "'Fira Code', monospace" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#58A6FF", fontSize: "12px" }}>// FORGOT_PASSWORD</span>
        <button onClick={() => { setShowForgotModal(false); setForgotStatus("idle"); setForgotEmail(""); }} style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer" }}>✕</button>
      </div>

      {forgotStatus === "sent" ? (
        <div style={{ color: "#7EE787", fontSize: "12px", background: "#23863622", border: "1px solid #238636", padding: "12px", borderRadius: "4px" }}>
          [✓] Reset link sent. Check your email.
        </div>
      ) : (
        <>
          <p style={{ color: "#8B949E", fontSize: "12px", margin: 0 }}>Enter your email and we'll send a reset link.</p>
          <div style={{ display: "flex", alignItems: "center", background: "#0D1117", border: "1px solid #30363D", borderRadius: "4px", paddingLeft: "10px" }}>
            <span style={{ color: "#7EE787", fontSize: "14px", fontWeight: "bold" }}>$</span>
            <input
              autoFocus
              type="email"
              placeholder="email_address"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleForgotPassword(); }}
              style={{ flex: 1, padding: "12px", background: "transparent", border: "none", color: "#C9D1D9", outline: "none", fontSize: "14px" }}
            />
          </div>
          <button
            onClick={handleForgotPassword}
            disabled={forgotStatus === "loading"}
            style={{ padding: "10px", borderRadius: "4px", border: "1px solid #238636", background: "#23863622", color: "#7EE787", fontWeight: "bold", cursor: "pointer" }}
          >
            {forgotStatus === "loading" ? "SENDING..." : "SEND_RESET_LINK"}
          </button>
        </>
      )}
    </div>
  </div>
)}
    </div>
  );
}

// --- STYLES ---
const containerStyle: React.CSSProperties = { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0D1117", fontFamily: "'Fira Code', monospace" };
const cardStyle: React.CSSProperties = { background: "#161B22", padding: "30px", borderRadius: "8px", border: "2px solid #30363D", width: "380px", display: "flex", flexDirection: "column", gap: "20px" };
const inputContainer: React.CSSProperties = { display: "flex", alignItems: "center", background: "#0D1117", border: "1px solid #30363D", borderRadius: "4px", paddingLeft: "10px" };
const promptStyle: React.CSSProperties = { color: "#7EE787", fontSize: "14px", fontWeight: "bold" };
const inputStyle: React.CSSProperties = { flex: 1, padding: "12px", background: "transparent", border: "none", color: "#C9D1D9", outline: "none", fontSize: "14px" };
const buttonStyle: React.CSSProperties = { padding: "12px", borderRadius: "4px", border: "1px solid #238636", background: "#23863622", color: "#7EE787", fontWeight: "bold", cursor: "pointer" };
const eyeButtonStyle: React.CSSProperties = { position: "absolute", right: "10px", top: "10px", background: "none", border: "none", cursor: "pointer", color: "#484F58" };
const avatarPreviewStyle: React.CSSProperties = { width: "80px", height: "80px", borderRadius: "50%", border: "2px dashed #30363D", background: "#0D1117", display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden", position: "relative" };
const uploadingOverlayStyle: React.CSSProperties = { position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", color: "#7EE787", fontSize: "8px", display: "flex", alignItems: "center", justifyContent: "center" };