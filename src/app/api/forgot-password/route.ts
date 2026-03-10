import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import crypto from "crypto";
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
    const { email } = await req.json();
    await connectDB();

    const User = mongoose.models.User;
    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await PasswordReset.create({ userId: user._id, token, expiresAt, used: false });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

   console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS length:", process.env.EMAIL_PASS?.length);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

await transporter.verify();
console.log("SMTP verified OK");

    await transporter.sendMail({
      from: `"RevChat" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "RevChat // PASSWORD_RESET_REQUEST",
      html: `
        <div style="background:#0D1117;padding:30px;font-family:'Courier New',monospace;color:#C9D1D9;">
          <h2 style="color:#7EE787;">RevChat // PASSWORD_RESET</h2>
          <p style="color:#8B949E;">A password reset was requested for your account.</p>
          <p style="color:#8B949E;">This link expires in <strong style="color:#58A6FF;">30 minutes</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#23863622;color:#7EE787;border:1px solid #238636;border-radius:4px;text-decoration:none;font-weight:bold;">
            RESET_PASSWORD
          </a>
          <p style="color:#484F58;font-size:11px;margin-top:20px;">If you didn't request this, ignore this email.</p>
          <p style="color:#484F58;font-size:10px;">// PROTOCOL: SHA-256 // TOKEN_EXPIRY: 30min</p>
        </div>
      `,
    });
    

    return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 });
  }
}