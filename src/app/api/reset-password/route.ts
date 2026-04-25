import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";

const PasswordResetSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  token: String,
  expiresAt: Date,
  used: Boolean,
});

const PasswordReset = mongoose.models.PasswordReset || mongoose.model("PasswordReset", PasswordResetSchema);

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();
    await connectDB();

    const resetDoc = await PasswordReset.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetDoc) {
      return NextResponse.json({ error: "TOKEN_INVALID_OR_EXPIRED" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 8);

    const User = mongoose.models.User;
    await User.findByIdAndUpdate(resetDoc.userId, { password: hashedPassword });

    await PasswordReset.findByIdAndUpdate(resetDoc._id, { used: true });

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}