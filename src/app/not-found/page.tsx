"use client";
import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ 
      height: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      background: "#090b0f", 
      color: "#C9D1D9",
      fontFamily: "'Fira Code', monospace",
      padding: "20px",
      textAlign: "center"
    }}>
      <div style={{ 
        border: "2px solid #6e40c9", 
        padding: "40px", 
        borderRadius: "8px", 
        boxShadow: "0 0 20px rgba(110,64,201,0.2)",
        maxWidth: "500px"
      }}>
        <h1 style={{ color: "#f85149", fontSize: "48px", marginBottom: "10px" }}>404</h1>
        <h2 style={{ color: "#a78bfa", fontSize: "14px", marginBottom: "20px" }}>
          // ERROR: REQUESTED_RESOURCE_NOT_FOUND
        </h2>
        <p style={{ fontSize: "14px", color: "#8B949E", marginBottom: "30px" }}>
          The path you are attempting to traverse does not exist in the current directory. 
          The entry may have been purged or relocated.
        </p>
        
        <Link href="/" style={{
          padding: "10px 20px",
          border: "1px solid #6e40c9",
          background: "#6e40c922",
          color: "#a78bfa",
          textDecoration: "none",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "bold",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#6e40c944")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#6e40c922")}
        >
          RETURN_TO_ROOT
        </Link>
      </div>
    </div>
  );
}