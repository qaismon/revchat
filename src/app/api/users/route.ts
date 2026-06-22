import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Message from "@/models/Message";
import Friendship from "@/models/Friendship";
import mongoose from "mongoose";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const currentUserId = searchParams.get("myId");
  const searchQuery = searchParams.get("search"); // optional search for discovery

  if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const myObjectId = new mongoose.Types.ObjectId(currentUserId);

  // --- DISCOVERY MODE: search for users to add as friends ---
  if (searchQuery && searchQuery.trim().length >= 2) {
    const query = escapeRegex(searchQuery.trim().toLowerCase());

    // Get all existing friendship IDs to exclude
    const existingFriendships = await Friendship.find({
      $or: [{ requester: myObjectId }, { recipient: myObjectId }],
    });
    const excludedIds = existingFriendships.flatMap((f) => [
      f.requester.toString(),
      f.recipient.toString(),
    ]);
    excludedIds.push(currentUserId); // also exclude self

    const results = await User.find({
      _id: { $nin: excludedIds.map((id) => new mongoose.Types.ObjectId(id)) },
      username: { $regex: query, $options: "i" },
    })
      .select("_id username avatar")
      .limit(10);

    return NextResponse.json(results.map((u) => ({
      _id: u._id.toString(),
      username: u.username,
      avatar: u.avatar,
      isDiscovery: true,
    })));
  }

  // --- FRIENDS MODE: return only accepted friends with last message ---
  const acceptedFriendships = await Friendship.find({
    status: "accepted",
    $or: [{ requester: myObjectId }, { recipient: myObjectId }],
  });

  if (acceptedFriendships.length === 0) {
    return NextResponse.json([]);
  }

  // Extract friend IDs
  const friendIds = acceptedFriendships.map((f) =>
    f.requester.toString() === currentUserId
      ? f.recipient.toString()
      : f.requester.toString()
  );

  const friends = await User.find(
    { _id: { $in: friendIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    "_id username avatar"
  );

  const friendsWithLastMsg = await Promise.all(
    friends.map(async (user) => {
      const targetId = user._id.toString();
      const msg = await Message.findOne({
        $or: [
          { senderId: currentUserId, receiverId: targetId },
          { senderId: targetId, receiverId: currentUserId },
        ],
      })
        .sort({ createdAt: -1 })
        .select("content createdAt");

      return {
        _id: targetId,
        username: user.username,
        avatar: user.avatar,
        lastMessage: msg ? msg.content : null,
      };
    })
  );

  return NextResponse.json(friendsWithLastMsg);
}