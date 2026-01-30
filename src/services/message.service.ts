import Message from "@/models/Message";
import { connectDB } from "@/lib/db";

export async function saveMessage(data: any) {
  await connectDB();
  return Message.create(data);
}
