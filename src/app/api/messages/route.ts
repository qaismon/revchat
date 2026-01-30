import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user1 = searchParams.get("user1"); // Current user
  const user2 = searchParams.get("user2"); // Peer

  if (!user1 || !user2) return NextResponse.json([], { status: 200 });

  await connectDB();
  const u1 = new mongoose.Types.ObjectId(user1);
  const u2 = new mongoose.Types.ObjectId(user2);

  // Mark all unread messages FROM the peer TO the current user as seen
  await Message.updateMany(
    { senderId: u2, receiverId: u1, seen: false },
    { $set: { seen: true } }
  );

  // Fetch full conversation
  const messages = await Message.find({
    $or: [
      { senderId: u1, receiverId: u2 },
      { senderId: u2, receiverId: u1 },
    ],
  }).sort({ createdAt: 1 });

  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  await connectDB();
  const body = await req.json();
  const { senderId, receiverId, content } = body;

  if (!senderId || !receiverId || !content) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const message = await Message.create({
    senderId: new mongoose.Types.ObjectId(senderId),
    receiverId: new mongoose.Types.ObjectId(receiverId),
    content,
    seen: false,
  });

  return NextResponse.json(message, { status: 201 });
}