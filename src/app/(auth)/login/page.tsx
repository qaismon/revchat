"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck, Camera } from "lucide-react";

async function generateAndStoreKeys(userId: string) {
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

  const exportedPriv = await window.crypto.subtle.exportKey("pkcs8", keys.privateKey);
  const privString = btoa(String.fromCharCode(...new Uint8Array(exportedPriv)));
  localStorage.setItem(`privKey_${userId}`, privString);

  const exportedPub = await window.crypto.subtle.exportKey("spki", keys.publicKey);
  const pubString = btoa(String.fromCharCode(...new Uint8Array(exportedPub)));

  const res = await fetch("/api/users/update-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, publicKey: pubString }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to sync public key");
  }
}

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(""); // New Avatar State
  const [error, setError] = useState("");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (res.ok) {
          router.push("/chat");
        }
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

  // Avatar Handler
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError("Avatar exceeds 2MB limit.");

    setIsUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setAvatar(reader.result as string);
      setIsUploading(false);
    };
  };

  const passwordStrength = useMemo(() => {
    if (!password) return { label: "", color: "transparent", width: "0%" };
    if (password.length < 6) return { label: "LOW_ENTROPY", color: "#ff4d4d", width: "33%" };
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);

    if (hasLetters && hasNumbers && hasSpecial && password.length >= 8) {
      return { label: "HIGH_ENTROPY", color: "#7EE787", width: "100%" };
    }
    if (hasLetters && hasNumbers) return { label: "MED_ENTROPY", color: "#ffad33", width: "66%" };
    return { label: "WEAK_HASH", color: "#ff4d4d", width: "33%" };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const endpoint = isRegistering ? "/api/register" : "/api/login";
    // Added avatar to payload
    const payload = isRegistering ? { username, email, password, avatar } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("userId", data.userId);
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
        }

        const existingKey = localStorage.getItem(`privKey_${data.userId}`);
        if (!existingKey) {
          if (window.isSecureContext) {
            try {
              await generateAndStoreKeys(data.userId);
            } catch (keyErr) {
              console.error("E2EE Sync Failed:", keyErr);
            }
          }
        }
        router.push("/chat");
      } else {
        setError(data.message || "Access Denied: Invalid Credentials");
      }
    } catch (err) {
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

        {/* Profile Pic Upload Section (Only on Register) */}
        {isRegistering && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={avatarPreviewStyle}>
              {avatar ? (
                <img src={avatar} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Camera color="#30363D" size={24} />
              )}
              {isUploading && <div style={uploadingOverlayStyle}>WRITING...</div>}
            </div>
            <label style={{ fontSize: "10px", color: "#58A6FF", cursor: "pointer", textDecoration: "underline" }}>
              [ SET_PROFILE_PICTURE ]
              <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
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
            <span style={{ fontSize: "12px", color: "#58A6FF", cursor: "pointer" }}>forgot_password</span>
          </div>
        )}

        <button type="submit" style={buttonStyle}>
          {isRegistering ? "REGISTER" : "AUTHENTICATE"}
        </button>

        <p style={{ textAlign: "center", marginTop: "10px", fontSize: "13px", color: "#8B949E" }}>
          {isRegistering ? "Existing user?" : "New user detected?"}{" "}
          <span onClick={() => setIsRegistering(!isRegistering)} style={{ color: "#7EE787", cursor: "pointer", fontWeight: "bold" }}>
            {isRegistering ? "[Login]" : "[Register]"}
          </span>
        </p>
      </form>
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

const avatarPreviewStyle: React.CSSProperties = {
  width: "80px",
  height: "80px",
  borderRadius: "50%",
  border: "2px dashed #30363D",
  background: "#0D1117",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  overflow: "hidden",
  position: "relative"
};

const uploadingOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.8)",
  color: "#7EE787",
  fontSize: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};