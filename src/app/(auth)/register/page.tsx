import { NextResponse } from "next/server";
import {connectDB} from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs"; // To secure passwords

export async function POST(req: Request) {
  try {
    await connectDB();
    const { email, password } = await req.json();

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "User already exists" }, { status: 400 });
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create new user
    const newUser = await User.create({
      email,
      password: hashedPassword,
    });

    return NextResponse.json({ userId: newUser._id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}