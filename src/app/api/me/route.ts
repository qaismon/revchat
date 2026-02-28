import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {connectDB} from "@/lib/db";
import User from "@/models/User";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie");

  if (!cookie) {
    return NextResponse.json(null, { status: 401 });
  }

  const token = cookie
    .split("; ")
    .find((c) => c.startsWith("accessToken="))
    ?.split("=")[1];

  if (!token) {
    return NextResponse.json(null, { status: 401 });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    await connectDB();
    const user = await User.findById(decoded.userId).select(
      "_id username email avatar"
    );

    return NextResponse.json(user);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
