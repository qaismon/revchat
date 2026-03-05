import { NextResponse } from "next/server";
import mongoose from "mongoose";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { userId, type, value, currentPassword } = await req.json();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "INVALID_USER_ID" }, { status: 400 });
    }

    // --- AVATAR UPDATE LOGIC ---
    if (type === "avatar") {
      await User.findByIdAndUpdate(userId, { avatar: value });
      return NextResponse.json({ success: true });
    }

    // --- USERNAME UPDATE LOGIC ---
    if (type === "username") {
      await User.findByIdAndUpdate(userId, { username: value });
      return NextResponse.json({ success: true });
    }

    // --- PASSWORD UPDATE LOGIC ---
    if (type === "password") {
      const user = await User.findById(userId);
      if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 401 });

      user.password = await bcrypt.hash(value, 10);
      await user.save();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "UNKNOWN_TYPE" }, { status: 400 });
  } catch (error: any) {
    console.error("UPDATE_API_ERROR:", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}