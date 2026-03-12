import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const { userId } = await req.json();
    const message = await Message.findById(id);

    if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (message.senderId.toString() !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await Message.findByIdAndUpdate(id, {
      deleted: true,
      content: null,
      contentSender: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}