"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!password || password !== confirm) {
      setMessage("Passwords do not match.");
      setStatus("error");
      return;
    }
    if (password.length < 6) {
      setMessage("Password too short.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage("Password updated. Redirecting...");
        setTimeout(() => router.push("/"), 2000);
      } else {
        setStatus("error");
        setMessage(data.error || "Reset failed.");
      }
    } catch {
      setStatus("error");
      setMessage("Connection failed.");
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0D1117", fontFamily: "'Fira Code', monospace" }}>
      <div style={{ background: "#161B22", padding: "30px", borderRadius: "8px", border: "2px solid #30363D", width: "380px", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", padding: "12px", background: "#161B22", borderRadius: "50%", border: "1px solid #30363D", marginBottom: "15px" }}>
            <ShieldCheck color="#7EE787" size={32} />
          </div>
          <h2 style={{ color: "#C9D1D9", fontSize: "1.2rem", margin: 0, letterSpacing: "1px" }}>RESET_PASSWORD</h2>
          <p style={{ color: "#8B949E", fontSize: "11px", marginTop: "5px" }}>// ENTER_NEW_CREDENTIALS</p>
        </div>

        {!token && (
          <div style={{ color: "#ff7b72", fontSize: "12px", background: "#ff7b7211", border: "1px solid #ff7b7233", padding: "10px", borderRadius: "4px" }}>
            [!] INVALID_RESET_LINK
          </div>
        )}

        {message && (
          <div style={{ color: status === "success" ? "#7EE787" : "#ff7b72", fontSize: "12px", background: status === "success" ? "#23863622" : "#ff7b7211", border: `1px solid ${status === "success" ? "#238636" : "#ff7b7233"}`, padding: "10px", borderRadius: "4px" }}>
            {status === "success" ? "[✓]" : "[!]"} {message}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", background: "#0D1117", border: "1px solid #30363D", borderRadius: "4px", paddingLeft: "10px", position: "relative" }}>
          <span style={{ color: "#7EE787", fontSize: "14px", fontWeight: "bold" }}>$</span>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="new_password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ flex: 1, padding: "12px", background: "transparent", border: "none", color: "#C9D1D9", outline: "none", fontSize: "14px", paddingRight: "45px" }}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "10px", background: "none", border: "none", cursor: "pointer", color: "#484F58" }}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", background: "#0D1117", border: "1px solid #30363D", borderRadius: "4px", paddingLeft: "10px" }}>
          <span style={{ color: "#7EE787", fontSize: "14px", fontWeight: "bold" }}>$</span>
          <input
            type="password"
            placeholder="confirm_password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            style={{ flex: 1, padding: "12px", background: "transparent", border: "none", color: "#C9D1D9", outline: "none", fontSize: "14px" }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={status === "loading" || !token}
          style={{ padding: "12px", borderRadius: "4px", border: "1px solid #238636", background: "#23863622", color: "#7EE787", fontWeight: "bold", cursor: status === "loading" ? "not-allowed" : "pointer", opacity: status === "loading" ? 0.6 : 1 }}
        >
          {status === "loading" ? "UPDATING..." : "COMMIT_NEW_PASSWORD"}
        </button>
      </div>
    </div>
  );
}