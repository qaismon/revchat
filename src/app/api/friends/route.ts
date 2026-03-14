import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Friendship from "@/models/Friendship";
import User from "@/models/User";
import mongoose from "mongoose";

// GET /api/friends?myId=xxx
// Returns: { friends: [...], incoming: [...], outgoing: [...] }
export async function GET(req: NextRequest) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const myId = searchParams.get("myId");

  if (!myId || !mongoose.Types.ObjectId.isValid(myId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const myObjectId = new mongoose.Types.ObjectId(myId);

  // Accepted friendships (either direction)
  const accepted = await Friendship.find({
    status: "accepted",
    $or: [{ requester: myObjectId }, { recipient: myObjectId }],
  }).populate("requester recipient", "_id username avatar");

  const friends = accepted.map((f) => {
    const other = String(f.requester._id) === myId ? f.recipient : f.requester;
    return { _id: other._id, username: (other as any).username, avatar: (other as any).avatar };
  });

  // Incoming pending requests (someone sent to me)
  const incoming = await Friendship.find({
    recipient: myObjectId,
    status: "pending",
  }).populate("requester", "_id username avatar");

  // Outgoing pending requests (I sent to someone)
  const outgoing = await Friendship.find({
    requester: myObjectId,
    status: "pending",
  }).populate("recipient", "_id username avatar");

  return NextResponse.json({
    friends,
    incoming: incoming.map((f) => ({
      friendshipId: f._id,
      user: f.requester,
    })),
    outgoing: outgoing.map((f) => ({
      friendshipId: f._id,
      user: f.recipient,
    })),
  });
}

// POST /api/friends
// Body: { myId, targetId, action: "request" | "accept" | "decline" | "remove" }
export async function POST(req: NextRequest) {
  await connectDB();
  const { myId, targetId, action } = await req.json();

  if (
    !myId || !targetId ||
    !mongoose.Types.ObjectId.isValid(myId) ||
    !mongoose.Types.ObjectId.isValid(targetId)
  ) {
    return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
  }

  if (myId === targetId) {
    return NextResponse.json({ error: "Cannot friend yourself" }, { status: 400 });
  }

  const myObjectId = new mongoose.Types.ObjectId(myId);
  const targetObjectId = new mongoose.Types.ObjectId(targetId);

  if (action === "request") {
    // Check if friendship already exists in either direction
    const existing = await Friendship.findOne({
      $or: [
        { requester: myObjectId, recipient: targetObjectId },
        { requester: targetObjectId, recipient: myObjectId },
      ],
    });
    if (existing) {
      return NextResponse.json({ error: "Request already exists", status: existing.status }, { status: 409 });
    }
    const friendship = await Friendship.create({ requester: myObjectId, recipient: targetObjectId });
    return NextResponse.json({ ok: true, friendshipId: friendship._id });
  }

  if (action === "accept") {
    // Only the recipient can accept
    const friendship = await Friendship.findOneAndUpdate(
      { requester: targetObjectId, recipient: myObjectId, status: "pending" },
      { status: "accepted" },
      { new: true }
    );
    if (!friendship) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (action === "decline") {
    // Recipient declines
    await Friendship.findOneAndDelete({
      requester: targetObjectId,
      recipient: myObjectId,
      status: "pending",
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    // Remove accepted friendship (either direction)
    await Friendship.findOneAndDelete({
      status: "accepted",
      $or: [
        { requester: myObjectId, recipient: targetObjectId },
        { requester: targetObjectId, recipient: myObjectId },
      ],
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    // Requester cancels their own pending request
    await Friendship.findOneAndDelete({
      requester: myObjectId,
      recipient: targetObjectId,
      status: "pending",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}