"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    // Check for both saved email and password
    const savedEmail = localStorage.getItem("rememberedEmail");
    const savedPassword = localStorage.getItem("rememberedPassword");
    
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    if (savedPassword) {
      setPassword(savedPassword);
    }
  }, []);

  const passwordStrength = useMemo(() => {
    if (!password) return { label: "", color: "transparent", width: "0%" };
    if (password.length < 6) return { label: "Too Short", color: "#ff4d4d", width: "33%" };
    
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);

    if (hasLetters && hasNumbers && hasSpecial && password.length >= 8) {
      return { label: "Strong", color: "#00a884", width: "100%" };
    }
    if (hasLetters && hasNumbers) {
      return { label: "Medium", color: "#ffad33", width: "66%" };
    }
    return { label: "Weak", color: "#ff4d4d", width: "33%" };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const endpoint = isRegistering ? "/api/register" : "/api/login";
    
    const payload = isRegistering 
      ? { username, email, password } 
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        // --- Updated Remember Me Logic (Email + Password) ---
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
          localStorage.setItem("rememberedPassword", password);
        } else {
          localStorage.removeItem("rememberedEmail");
          localStorage.removeItem("rememberedPassword");
        }

        localStorage.setItem("userId", data.userId);
        router.push("/chat");
      } else {
        setError(data.message || "Something went wrong");
      }
    } catch (err) {
      setError("Failed to connect to server");
    }
  };

  return (
    <div style={containerStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <h2 style={{ textAlign: "center", color: "#075e54" }}>
          {isRegistering ? "Create Account" : "Login"}
        </h2>
        
        {error && <p style={{ color: "red", fontSize: "14px" }}>{error}</p>}

        {isRegistering && (
          <input
            type="text"
            placeholder="Username"
            style={inputStyle}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        )}

        <input
          type="email"
          placeholder="Email"
          style={inputStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            style={{ ...inputStyle, paddingRight: "45px" }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: "absolute",
              right: "12px",
              top: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#888",
            }}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />} 
          </button>
        </div>

        {isRegistering && password && (
          <div style={{ marginTop: "-10px", marginBottom: "5px" }}>
            <div style={{ height: "4px", width: "100%", background: "#eee", borderRadius: "2px" }}>
              <div style={{ 
                height: "100%", 
                width: passwordStrength.width, 
                background: passwordStrength.color, 
                transition: "width 0.3s ease",
                borderRadius: "2px" 
              }} />
            </div>
            <span style={{ fontSize: "11px", color: passwordStrength.color, fontWeight: "bold" }}>
              {passwordStrength.label}
            </span>
          </div>
        )}

        {!isRegistering && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "-5px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", cursor: "pointer", color: "#666" }}>
              <input 
                type="checkbox" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
              />
              Remember Me
            </label>
            
            <span 
              onClick={() => alert("Redirecting to password reset...")} 
              style={{ fontSize: "13px", color: "#128c7e", cursor: "pointer", fontWeight: "500" }}
            >
              Forgot Password?
            </span>
          </div>
        )}

        <button type="submit" style={buttonStyle}>
          {isRegistering ? "Sign Up" : "Log In"}
        </button>

        <p style={{ textAlign: "center", marginTop: "15px", fontSize: "14px" }}>
          {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
          <span 
            onClick={() => setIsRegistering(!isRegistering)} 
            style={{ color: "#128c7e", cursor: "pointer", fontWeight: "bold" }}
          >
            {isRegistering ? "Login here" : "Register here"}
          </span>
        </p>
      </form>
    </div>
  );
}

const containerStyle: React.CSSProperties = { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f0f2f5" };
const cardStyle: React.CSSProperties = { background: "white", padding: "40px", borderRadius: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", width: "350px", display: "flex", flexDirection: "column", gap: "15px" };
const inputStyle: React.CSSProperties = { padding: "12px", borderRadius: "5px", border: "1px solid #ddd", outline: "none" };
const buttonStyle: React.CSSProperties = { padding: "12px", borderRadius: "5px", border: "none", background: "#00a884", color: "white", fontWeight: "bold", cursor: "pointer" };