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

  // ✅ APIs
  const isPublicApi =
    path.startsWith("/api/login") ||
    path.startsWith("/api/register") ||
    path.startsWith("/api/upload-avatar") ||
    path.startsWith("/api/upload-voice") ||
    path.startsWith("/api/forgot-password") ||
    path.startsWith("/api/messages") ||
    path.startsWith("/api/reset-password");

  // ---------------- API handling ----------------
  if (isApiRoute) {
    if (!token && !isPublicApi) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
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