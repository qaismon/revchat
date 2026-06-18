import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { userId, encryptedKey } = await req.json();

    if (!userId || !encryptedKey) {
      return NextResponse.json({ message: "Missing userId or encryptedKey" }, { status: 400 });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { encryptedPrivateKey: encryptedKey } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Backup saved" }, { status: 200 });
  } catch (error) {
    console.error("Backup-key POST error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectDB();

    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    if (!token) {
      return NextResponse.json({ encryptedKey: null }, { status: 200 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).select("encryptedPrivateKey");

    if (!user || !user.encryptedPrivateKey) {
      return NextResponse.json({ encryptedKey: null }, { status: 200 });
    }

    return NextResponse.json({ encryptedKey: user.encryptedPrivateKey }, { status: 200 });
  } catch (error) {
    console.error("Backup-key GET error:", error);
    return NextResponse.json({ encryptedKey: null }, { status: 200 });
  }
}
