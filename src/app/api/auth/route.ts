import { registerUser, loginUser } from "@/services/auth.service";

export async function POST(req: Request) {
  const body = await req.json();

  if (body.type === "register") {
    return registerUser(body);
  }

  if (body.type === "login") {
    return loginUser(body);
  }

  return new Response("Invalid request", { status: 400 });
}
