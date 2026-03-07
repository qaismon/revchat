import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";

// PATCH /api/messages/status
// Body: { senderId, receiverId, status: "delivered" | "seen" }
export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const { senderId, receiverId, status } = await req.json();

    if (!senderId || !receiverId || !status) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (status === "delivered") {
      // Mark all undelivered messages from sender to receiver as delivered
      await Message.updateMany(
        { senderId, receiverId, delivered: false },
        { $set: { delivered: true } }
      );
    } else if (status === "seen") {
      // Mark all unseen messages from sender to receiver as seen + delivered
      await Message.updateMany(
        { senderId, receiverId, seen: false },
        { $set: { seen: true, delivered: true } }
      );
    } else {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Message status update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}