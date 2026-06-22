import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("accessToken")?.value;
  const path = req.nextUrl.pathname;

  const isApiRoute = path.startsWith("/api");

  // ✅ Pages
  const isAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/reset-password");

  const isPublicPage = path === "/" || isAuthPage;

  // ✅ Public APIs (no auth required)
  const isPublicApi =
    path.startsWith("/api/login") ||
    path.startsWith("/api/register") ||
    path.startsWith("/api/upload-avatar") ||
    path.startsWith("/api/forgot-password") ||
    path.startsWith("/api/reset-password");

  // ---------------- API handling ----------------
  if (isApiRoute) {
    if (!token && !isPublicApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = NextResponse.next();
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return response;
  }

  // ---------------- PAGE handling ----------------
  // Not logged in → block protected pages
  if (!token && !isPublicPage) {
    if (path === "/unauthorized") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Logged in → block auth pages
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};