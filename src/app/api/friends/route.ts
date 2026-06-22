import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Friendship from "@/models/Friendship";
import User from "@/models/User";
import mongoose from "mongoose";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/friends
export async function GET(req: NextRequest) {
  const userId = getUserFromRequest(req);
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const myObjectId = new mongoose.Types.ObjectId(userId);

  const accepted = await Friendship.find({
    status: "accepted",
    $or: [{ requester: myObjectId }, { recipient: myObjectId }],
  }).populate("requester recipient", "_id username avatar");

  const friends = accepted.map((f) => {
    const other = String(f.requester._id) === userId ? f.recipient : f.requester;
    return { _id: other._id, username: (other as any).username, avatar: (other as any).avatar };
  });

  const incoming = await Friendship.find({
    recipient: myObjectId,
    status: "pending",
  }).populate("requester", "_id username avatar");

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
export async function POST(req: NextRequest) {
  const userId = getUserFromRequest(req);
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { targetId, action } = await req.json();

  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    return NextResponse.json({ error: "Invalid targetId" }, { status: 400 });
  }

  if (userId === targetId) {
    return NextResponse.json({ error: "Cannot friend yourself" }, { status: 400 });
  }

  const myObjectId = new mongoose.Types.ObjectId(userId);
  const targetObjectId = new mongoose.Types.ObjectId(targetId);

  if (action === "request") {
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
    const friendship = await Friendship.findOneAndUpdate(
      { requester: targetObjectId, recipient: myObjectId, status: "pending" },
      { status: "accepted" },
      { new: true }
    );
    if (!friendship) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (action === "decline") {
    await Friendship.findOneAndDelete({
      requester: targetObjectId,
      recipient: myObjectId,
      status: "pending",
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
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
    await Friendship.findOneAndDelete({
      requester: myObjectId,
      recipient: targetObjectId,
      status: "pending",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}