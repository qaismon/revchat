import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import GroupMessage from "@/models/GroupMessage";

// GET /api/group-messages?groupId&limit=30&before=ISO
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
  const before = searchParams.get("before");

  if (!groupId)
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });

  await connectDB();

  const query: any = {
    groupId: new mongoose.Types.ObjectId(groupId),
  };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await GroupMessage.find(query)
    .limit(limit + 1)
    .sort({ createdAt: -1 })
    .lean();

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();
  messages.reverse();

  return NextResponse.json({ messages, hasMore });
}

// POST /api/group-messages
export async function POST(req: Request) {
  await connectDB();

  const { groupId, senderId, senderName, senderAvatar, content } =
    await req.json();

  if (!groupId || !senderId || !senderName || !content) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const message = await GroupMessage.create({
    groupId: new mongoose.Types.ObjectId(groupId),
    senderId: new mongoose.Types.ObjectId(senderId),
    senderName,
    senderAvatar: senderAvatar || "",
    content,
  });

  return NextResponse.json(message, { status: 201 });
}
