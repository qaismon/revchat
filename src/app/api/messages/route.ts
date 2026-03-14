import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Friendship from "@/models/Friendship";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user1 = searchParams.get("user1"); // Current user
  const user2 = searchParams.get("user2"); // Peer

  if (!user1 || !user2) return NextResponse.json([], { status: 200 });

  await connectDB();
  const u1 = new mongoose.Types.ObjectId(user1);
  const u2 = new mongoose.Types.ObjectId(user2);

  await Message.updateMany(
    { senderId: u2, receiverId: u1, seen: false },
    { $set: { seen: true } }
  );

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
  
  // Destructure contentSender from the request body
  const { senderId, receiverId, content, contentSender } = body;

const friendship = await Friendship.findOne({
  status: "accepted",
  $or: [
    { requester: senderId, recipient: receiverId },
    { requester: receiverId, recipient: senderId },
  ],
});
if (!friendship) {
  return NextResponse.json({ error: "Not friends" }, { status: 403 });
}

  // contentSender is now a required field for the double-encryption strategy
  if (!senderId || !receiverId || !content || !contentSender) {
    return NextResponse.json({ error: "Missing encrypted fields" }, { status: 400 });
  }

  const message = await Message.create({
    senderId: new mongoose.Types.ObjectId(senderId),
    receiverId: new mongoose.Types.ObjectId(receiverId),
    content,       // Encrypted with Peer's Public Key
    contentSender, // Encrypted with My (Sender's) Public Key
    seen: false,
  });

  return NextResponse.json(message, { status: 201 });
}