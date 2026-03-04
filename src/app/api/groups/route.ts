import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Group from "@/models/Group";
import User from "@/models/User";

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

export async function GET(req: Request) {
  const userId = getUserFromRequest(req);
  if (!userId) return NextResponse.json(null, { status: 401 });

  await connectDB();

  const groups = await Group.find({
    members: new mongoose.Types.ObjectId(userId),
  })
    .populate("members", "_id username avatar")
    .populate("admin", "_id username")
    .sort({ updatedAt: -1 });

  return NextResponse.json(groups);
}

// POST /api/groups - Create a new group
export async function POST(req: Request) {
  const userId = getUserFromRequest(req);
  if (!userId) return NextResponse.json(null, { status: 401 });

  await connectDB();

  const { name, description, memberIds } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  const allMemberIds = Array.from(
    new Set([userId, ...(memberIds || [])])
  ).map((id) => new mongoose.Types.ObjectId(id as string));

  const group = await Group.create({
    name: name.trim(),
    description: description?.trim() || "",
    admin: new mongoose.Types.ObjectId(userId),
    members: allMemberIds,
  });

  const populated = await Group.findById(group._id)
    .populate("members", "_id username avatar")
    .populate("admin", "_id username");

  return NextResponse.json(populated, { status: 201 });
}
