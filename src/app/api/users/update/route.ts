// app/api/users/update/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { userId, type, value, currentPassword } = await req.json();

    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let updateData: any = {};

    switch (type) {
      case "avatar":
        updateData.avatar = value;
        break;
      case "username":
        updateData.username = value;
        break;
      case "password":
        // Verify current password first
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return NextResponse.json({ error: "Wrong current password" }, { status: 401 });
        
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(value, salt);
        break;
      default:
        return NextResponse.json({ error: "Invalid update type" }, { status: 400 });
    }

    await User.findByIdAndUpdate(userId, updateData);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}