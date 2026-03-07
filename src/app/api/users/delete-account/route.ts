import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Message from "@/models/Message";
import Group from "@/models/Group";
import mongoose from "mongoose";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const { userId } = await req.json();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "INVALID_USER_ID" }, { status: 400 });
    }

    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    if (user.avatar && user.avatar.includes("utfs.io/f/")) {
      try {
        const fileKey = user.avatar.split("/f/")[1];
        if (fileKey) await utapi.deleteFiles(fileKey);
      } catch (err) {
        console.error("Avatar CDN delete failed (non-fatal):", err);
      }
    }

    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }]
    });

    await Group.updateMany(
      { members: userId },
      { $pull: { members: userId } }
    );


    const adminGroups = await Group.find({ admin: userId });
    for (const group of adminGroups) {
      await Group.findByIdAndDelete(group._id);
    }

    await User.findByIdAndDelete(userId);

    const response = NextResponse.json({ success: true });
    response.cookies.set("accessToken", "", { maxAge: 0, path: "/" });
    return response;

  } catch (err) {
    console.error("DELETE_ACCOUNT_ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}