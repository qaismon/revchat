"use client";
import { useState, useEffect } from "react";

export default function ProfilePage({ userId }: { userId: string }) {
  const [avatar, setAvatar] = useState("");
  const [uploading, setUploading] = useState(false);

  // Fetch current avatar on load
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.avatar) setAvatar(data.avatar);
      });
  }, [userId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; // FIXED: Added this line back
    if (!file) return;

    console.log("Uploading for User ID:", userId);
    if (!userId) {
      alert("Error: User ID is missing!");
      return;
    }

    // Convert image to Base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Image = reader.result as string;
      setUploading(true);

      try {
        const res = await fetch("/api/users/update-avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, avatar: base64Image }),
        });

        const result = await res.json();

        if (res.ok) {
          setAvatar(base64Image);
          alert("Profile picture updated!");
        } else {
          alert(`Failed: ${result.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed. Check console.");
      } finally {
        setUploading(false);
      }
    };
  };

  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>Your Profile</h2>
      <div style={{ margin: "20px auto", width: "120px", height: "120px", borderRadius: "50%", background: "#ddd", overflow: "hidden", border: "3px solid #075e54" }}>
        {avatar ? (
          <img src={avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ paddingTop: "45px" }}>No Photo</div>
        )}
      </div>
      
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        disabled={uploading}
        style={{ marginTop: "20px" }}
      />
      <p>{uploading ? "Uploading..." : "Click to change avatar"}</p>
    </div>
  );
}