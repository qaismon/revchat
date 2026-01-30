import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { email, password } = await req.json();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // 1. Create the Token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET!, 
      { expiresIn: "7d" }
    );

    // 2. Create the Response
    const response = NextResponse.json({ 
      message: "Login successful", 
      userId: user._id 
    }, { status: 200 });

    // 3. Set the Cookie (match the name 'accessToken' used in your /api/me)
    response.cookies.set("accessToken", token, {
      httpOnly: true, // Security: prevents JS from reading the cookie
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}