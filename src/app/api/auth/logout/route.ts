import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ 
    message: "SESSION_TERMINATED", 
    status: "SUCCESS" 
  });
  
  response.cookies.set("accessToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(0), 
    path: "/",
  });

  return response;
}