import { NextResponse } from "next/server";
import mongoose from "mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  return mongoose.connect(process.env.MONGODB_URI!);
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    // 1. Get username from request body
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    }

    // 2. Check if Email or Username already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      const message = existingUser.email === email.toLowerCase() 
        ? "Email already registered" 
        : "Username already taken";
      return NextResponse.json({ message }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create User with the provided username
    const newUser = await User.create({
      username: username.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({ 
      message: "User registered successfully", 
      userId: newUser._id 
    }, { status: 201 });

    response.cookies.set("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;

  } catch (error: any) {
    console.error("REGISTRATION_ERROR:", error);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}