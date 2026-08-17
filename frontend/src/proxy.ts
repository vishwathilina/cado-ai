import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const authenticated = request.cookies.has("access_token");
  const authPage = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register";
  const protectedPage = ["/dashboard", "/upload", "/learn", "/quiz"].some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  if (protectedPage && !authenticated) return NextResponse.redirect(new URL("/login", request.url));
  if (authPage && authenticated) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/learn/:path*", "/quiz/:path*", "/login", "/register"],
};
