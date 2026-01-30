import { NextResponse } from "next/server";
import mongoose from "mongoose";
import User from "@/models/User";
import { connectDB } from "@/lib/db"; // Ensure this matches your project

export async function GET(
  req: Request, 
  { params }: { params: Promise<{ id: string }> | { id: string } } 
) {
  try {
    await connectDB();

    // In Next.js 15+, params is a Promise. We must await it.
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID format" }, { status: 400 });
    }

    const user = await User.findById(id).select("username email lastSeen avatar");

    if (!user) {
      return NextResponse.json({ username: "Unknown User" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("API_USER_ERROR:", error);
    return NextResponse.json({ message: "Server Error" }, { status: 400 });
  }
}