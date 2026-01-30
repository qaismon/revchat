export async function POST() {
  return new Response("Logged out", {
    headers: {
      "Set-Cookie": "accessToken=; HttpOnly; Path=/; Max-Age=0",
    },
  });
}
