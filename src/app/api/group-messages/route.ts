import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import GroupMessage from "@/models/GroupMessage";

// GET /api/group-messages?groupId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");

  if (!groupId)
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });

  await connectDB();

  const messages = await GroupMessage.find({
    groupId: new mongoose.Types.ObjectId(groupId),
  }).sort({ createdAt: 1 });

  return NextResponse.json(messages);
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
