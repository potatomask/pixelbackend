import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Better Auth session cookie (set by better-auth)
  // In production with secure cookies, the prefix is __Secure-
  const sessionToken =
    request.cookies.get("__Secure-better-auth.session_token")?.value ||
    request.cookies.get("better-auth.session_token")?.value;

  // Protect /dev/*, /dashboard/*, /onboarding — require auth
  if (pathname.startsWith("/dev") || pathname.startsWith("/dashboard") || pathname === "/onboarding") {
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/signin", request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (
    pathname === "/signin" ||
    pathname === "/signup" ||
    pathname === "/login"
  ) {
    if (sessionToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // Redirect old /login to /signin
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/signin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dev", "/dev/:path*", "/dashboard/:path*", "/signin", "/signup", "/login", "/onboarding"],
};
