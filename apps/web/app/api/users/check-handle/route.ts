import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// System routes that are always blocked as usernames
const SYSTEM_PATHS = [
  "api", "dashboard", "dev", "admin", "login", "signin", "signup",
  "settings", "tile", "test", "public", "static", "_next",
];

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`check-handle:${ip}`, 30, 60_000)) {
    return NextResponse.json({ available: false, reason: "rate_limited" }, { status: 429 });
  }

  const handle = request.nextUrl.searchParams.get("handle");
  if (!handle) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  // Min 3 characters
  if (handle.length < 3) {
    return NextResponse.json({ available: false, reason: "too_short" });
  }

  // Check system reserved paths
  if (SYSTEM_PATHS.includes(handle.toLowerCase())) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  // Check custom reserved paths from admin settings
  const setting = await prisma.siteSetting.findUnique({ where: { key: "reserved-paths" } });
  if (setting?.value) {
    try {
      const customPaths: string[] = JSON.parse(setting.value);
      if (customPaths.includes(handle.toLowerCase())) {
        return NextResponse.json({ available: false, reason: "reserved" });
      }
    } catch {
      // ignore parse errors
    }
  }

  const existing = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });

  return NextResponse.json({ available: !existing });
}
