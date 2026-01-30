import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { hashPassword, comparePassword } from "@/utils/hash";
import { signToken } from "@/lib/jwt";

export async function registerUser(data: any) {
  const { username, email, password } = data;

  await connectDB();

  const exists = await User.findOne({ email });
  if (exists) {
    return new Response("User already exists", { status: 400 });
  }

  const hashed = await hashPassword(password);

  const user = await User.create({
    username,
    email,
    password: hashed,
  });

  const token = signToken({ userId: user._id });

  return Response.json(
    { user: { id: user._id, username, email } },
    {
      headers: {
        "Set-Cookie": `accessToken=${token}; HttpOnly; Path=/; SameSite=Strict`,
      },
    }
  );
}

export async function loginUser(data: any) {
  const { email, password } = data;

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    return new Response("Invalid credentials", { status: 401 });
  }

  const match = await comparePassword(password, user.password);
  if (!match) {
    return new Response("Invalid credentials", { status: 401 });
  }

  const token = signToken({ userId: user._id });

  return Response.json(
    { user: { id: user._id, username: user.username, email } },
    {
      headers: {
        "Set-Cookie": `accessToken=${token}; HttpOnly; Path=/; SameSite=Strict`,
      },
    }
  );
}
