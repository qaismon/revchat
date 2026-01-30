// app/profile/page.tsx
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import ProfilePageClient from "./ProfilePageClient";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  // DEBUG 1: See all available cookies in your terminal
  console.log("Available Cookies:", allCookies.map(c => c.name));

  const token = cookieStore.get("accessToken")?.value; // Verify this matches your login cookie name

  if (!token) {
    console.log("❌ No token found in cookies, redirecting...");
    redirect("/login");
  }

  try {
    const decoded = verifyToken(token) as { userId: string };
    
    // DEBUG 2: See what's actually inside your JWT
    console.log("✅ Decoded JWT:", decoded);

    if (!decoded.userId) {
      console.log("❌ Token valid, but userId is missing from payload.");
      redirect("/login");
    }

    return <ProfilePageClient userId={decoded.userId} />;
  } catch (error) {
    console.error("❌ JWT Verification failed:", error);
    redirect("/login");
  }
}