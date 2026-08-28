import { NextRequest, NextResponse } from "next/server";
import { safeQuizNext } from "@/lib/next-path";

export function proxy(request: NextRequest) {
  const hasAccess = request.cookies.has("access_token");
  const authenticated = hasAccess || request.cookies.has("refresh_token");
  const authPage = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register";
  const protectedPage = ["/dashboard", "/upload", "/learn", "/quiz", "/history"].some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  if (protectedPage && !authenticated) {
    const login = new URL("/login", request.url);
    const next = safeQuizNext(request.nextUrl.pathname);
    if (next) login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }
  if (authPage && hasAccess) {
    const next = safeQuizNext(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next || "/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/upload/:path*",
    "/learn/:path*",
    "/quiz/:path*",
    "/history/:path*",
    "/login",
    "/register",
  ],
};
