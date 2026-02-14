import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { userId, publicKey } = await req.json();

    // DIAGNOSTIC LOGS
    console.log("--- DATABASE DIAGNOSTIC ---");
    console.log("Connected to DB:", mongoose.connection.name); // This tells you the DB name
    console.log("Updating User ID:", userId);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { publicKey: publicKey, isEncryptionEnabled: true } },
      { new: true }
    );

    if (!updatedUser) {
      console.log("❌ USER NOT FOUND IN THIS DB");
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    console.log("✅ SUCCESS. Document in DB now looks like:", updatedUser);
    return NextResponse.json({ message: "Updated", user: updatedUser.username }, { status: 200 });

  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}