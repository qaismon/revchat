import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Group from "@/models/Group";
import GroupMessage from "@/models/GroupMessage";
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

// GET /api/groups/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserFromRequest(req);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  await connectDB();

  const group = await Group.findById(id)
    .populate("members", "_id username avatar")
    .populate("admin", "_id username");

  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const isMember = group.members.some((m: any) => String(m._id) === userId);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(group);
}

// PATCH /api/groups/[id] 
export async function PATCH(
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
    return NextResponse.json({ error: "Only admin can update" }, { status: 403 });

  const { name, description } = await req.json();
  if (name) group.name = name.trim();
  if (description !== undefined) group.description = description.trim();
  await group.save();

  socket.emit("trigger-group-update", { action: "update", groupId: id });

  return NextResponse.json(group);
}

// DELETE /api/groups/[id] - Delete group and all messages (admin only)
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
  if (String(group.admin) !== userId)
    return NextResponse.json({ error: "Only admin can delete this group" }, { status: 403 });

  await GroupMessage.deleteMany({ groupId: new mongoose.Types.ObjectId(id) });
  await Group.findByIdAndDelete(id);

  socket.emit("trigger-group-update", { action: "delete", groupId: id });

  return NextResponse.json({ success: true });
}
