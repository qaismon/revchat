"use client";
import { useRouter } from "next/navigation";

export default function Unauthorized() {
  const router = useRouter();

  return (
    <div style={{ 
      height: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      background: "#0d1117", 
      color: "#f85149",
      fontFamily: "'Fira Code', monospace"
    }}>
      <div style={{ 
        background: "#161b22", 
        border: "1px solid #f85149", 
        padding: "30px", 
        borderRadius: "4px",
        boxShadow: "0 0 15px rgba(248, 81, 73, 0.1)"
      }}>
        <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>
          ⚠️ ACCESS_DENIED
        </div>
        <div style={{ fontSize: "12px", color: "#8B949E", marginBottom: "20px" }}>
          // AUTH_TOKEN_INVALID
        </div>
        <pre style={{ 
          background: "#000", 
          padding: "15px", 
          borderRadius: "4px", 
          fontSize: "12px", 
          color: "#f85149",
          textAlign: "left"
        }}>
          {`Status: 403 Forbidden\nSource: Internal_Firewall\nAction: Blocked_Request`}
        </pre>
        <button 
          onClick={() => router.push("/login")}
          style={{
            marginTop: "20px",
            width: "100%",
            padding: "12px",
            background: "#f85149",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
    EXIT
        </button>
      </div>
    </div>
  );
}