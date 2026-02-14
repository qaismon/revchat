import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Message from "@/models/Message";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  await connectDB();
  
  const { searchParams } = new URL(req.url);
  const currentUserId = searchParams.get("myId");

  if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const myObjectId = new mongoose.Types.ObjectId(currentUserId);

  // Fetch all users except me
  const users = await User.find({ _id: { $ne: myObjectId } }, "_id username avatar");

  const usersWithLastMsg = await Promise.all(
    users.map(async (user) => {
      const targetId = user._id.toString();

      const msg = await Message.findOne({
        $or: [
          { senderId: currentUserId, receiverId: targetId },
          { senderId: targetId, receiverId: currentUserId },
        ],
      })
      .sort({ createdAt: -1 })
      .select("text");

      return {
        _id: targetId, // Force ID to string
        username: user.username,
        avatar: user.avatar,
        lastMessage: msg ? msg.text : null,
      };
    })
  );

  return NextResponse.json(usersWithLastMsg);
}