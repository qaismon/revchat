// app/api/posts/route.ts
import { createPost } from "@/services/post.service";

export async function POST(req: Request) {
  const body = await req.json();
  return createPost(body);
}
