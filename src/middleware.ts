import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("accessToken")?.value;
  const path = req.nextUrl.pathname;

  const isApiRoute = path.startsWith("/api");
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register");
  const isPublicApi = path.startsWith("/api/login") || path.startsWith("/register");


  if (isApiRoute) {
    if (!token && !isPublicApi) {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // RULE B: If LOGGED IN - Block MANUAL browser visits to ANY API route
    const isBrowserVisit = req.headers.get("accept")?.includes("text/html");
    if (token && isBrowserVisit) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Allow internal app fetch calls to proceed
    return NextResponse.next();
  }

  
  if (!token && !isAuthPage) {
    if (path === "/unauthorized") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)", // Catch-all for absolute protection
  ],
};