import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Group from "@/models/Group";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

function getUserFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const token = cookie
    .split("; ")
    .find((c) => c.startsWith("accessToken="))
    ?.split("=")[1];
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.userId;
  } catch {
    return null;
  }
}

// POST /api/groups/[id]/members - Add a member (admin only)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserFromRequest(req);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  await connectDB();

  const group = await Group.findById(id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (String(group.admin) !== userId)
    return NextResponse.json({ error: "Only admin can add members" }, { status: 403 });

  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  const memberObjId = new mongoose.Types.ObjectId(memberId);
  const alreadyMember = group.members.some(
    (m: any) => String(m) === String(memberObjId)
  );

  if (!alreadyMember) {
    group.members.push(memberObjId);
    await group.save();
  }

  const populated = await Group.findById(id)
    .populate("members", "_id username avatar")
    .populate("admin", "_id username");

  socket.emit("trigger-group-update", { action: "addMember", groupId: id });

  return NextResponse.json(populated);
}

// DELETE /api/groups/[id]/members - Remove a member (admin only OR self)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserFromRequest(req);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  await connectDB();

  const group = await Group.findById(id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  // A user can remove themselves (exit group), OR admin can remove a user
  const isSelf = memberId === userId;
  const isAdmin = String(group.admin) === userId;

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Only admin can remove other members" }, { status: 403 });
  }

  if (isAdmin && isSelf) {
    return NextResponse.json({ error: "Admin cannot remove themselves, must delete group or transfer" }, { status: 400 });
  }

  group.members = group.members.filter(
    (m: any) => String(m) !== String(memberId)
  );
  await group.save();

  const populated = await Group.findById(id)
    .populate("members", "_id username avatar")
    .populate("admin", "_id username");

  socket.emit("trigger-group-update", { action: "removeMember", groupId: id });

  return NextResponse.json(populated);
}
