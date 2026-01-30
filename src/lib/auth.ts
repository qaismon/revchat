// lib/auth.ts (or wherever your jwt logic is)
import { cookies } from "next/headers";
import { verifyToken } from "./jwt"; // your existing file

export async function getUserIdFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value; // or whatever your cookie name is

  if (!token) return null;

  try {
    const decoded = verifyToken(token) as { userId: string };
    return decoded.userId;
  } catch (err) {
    return null;
  }
}