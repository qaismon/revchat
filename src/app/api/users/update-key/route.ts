import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { publicKey } = await req.json();

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { publicKey, isEncryptionEnabled: true } },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Updated", user: updatedUser.username }, { status: 200 });

  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}