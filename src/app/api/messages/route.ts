import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Friendship from "@/models/Friendship";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const userId = getUserFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const user1 = searchParams.get("user1");
  const user2 = searchParams.get("user2");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
  const before = searchParams.get("before");

  if (!user1 || !user2) return NextResponse.json([], { status: 200 });

  // Must be one of the participants
  if (userId !== user1 && userId !== user2) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const u1 = new mongoose.Types.ObjectId(user1);
  const u2 = new mongoose.Types.ObjectId(user2);

  await Message.updateMany(
    { senderId: u2, receiverId: u1, seen: false },
    { $set: { seen: true } }
  );

  const query: any = {
    $or: [
      { senderId: u1, receiverId: u2 },
      { senderId: u2, receiverId: u1 },
    ],
  };
  if (before) {
    if (isNaN(new Date(before).getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Message.find(query)
    .select("senderId receiverId content contentSender createdAt seen deleted")
    .limit(limit + 1)
    .sort({ createdAt: -1 })
    .lean();

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();
  messages.reverse();

  return NextResponse.json({ messages, hasMore });
}

export async function POST(req: Request) {
  const userId = getUserFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();

  const { senderId, receiverId, content, contentSender } = body;

  if (senderId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (!senderId || !receiverId || !content || !contentSender) {
    return NextResponse.json({ error: "Missing encrypted fields" }, { status: 400 });
  }

  const message = await Message.create({
    senderId: new mongoose.Types.ObjectId(senderId),
    receiverId: new mongoose.Types.ObjectId(receiverId),
    content,
    contentSender,
    seen: false,
  });

  return NextResponse.json(message, { status: 201 });
}