import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-utils";
import { UpdateProfileSchema, isUrlSafe } from "@mypixelpage/shared";

// System routes that are always blocked as usernames
const SYSTEM_PATHS = [
  "api", "dashboard", "dev", "admin", "login", "signin", "signup",
  "settings", "tile", "test", "public", "static", "_next",
];

// GET /api/users/profile — Read creator profile (includes current tier)
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: {
      id: true,
      handle: true,
      displayName: true,
      bio: true,
      image: true,
      tier: true,
      tierExpiresAt: true,
      storageUsed: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: dbUser });
}

// PUT /api/users/profile — Update creator profile
export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch current user from DB to get handle (session.user may not have custom fields)
  const dbUser = await prisma.user.findUnique({ where: { id: user!.id }, select: { handle: true } });

  // Check handle availability if changed
  if (typeof body.handle === "string" && body.handle !== dbUser?.handle) {
    const handle = body.handle;

    // Min 3 characters
    if (handle.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }

    // Check system reserved paths
    if (SYSTEM_PATHS.includes(handle.toLowerCase())) {
      return NextResponse.json({ error: "This username is reserved" }, { status: 400 });
    }

    // Check custom reserved paths
    const setting = await prisma.siteSetting.findUnique({ where: { key: "reserved-paths" } });
    if (setting?.value) {
      try {
        const customPaths: string[] = JSON.parse(setting.value);
        if (customPaths.includes(handle.toLowerCase())) {
          return NextResponse.json({ error: "This username is reserved" }, { status: 400 });
        }
      } catch {
        // ignore parse errors
      }
    }

    const existing = await prisma.user.findUnique({ where: { handle } });
    if (existing && existing.id !== user!.id) {
      return NextResponse.json({ error: "Handle already taken" }, { status: 400 });
    }
  }

  // Map profile fields to Prisma User fields
  const data: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName;
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.image !== undefined) {
    if (!parsed.data.image) {
      // Empty/null → use default avatar
      data.image = "/favicon-192x192.png";
    } else if (!isUrlSafe(parsed.data.image)) {
      return NextResponse.json({ error: "Invalid image URL. Only HTTPS URLs are allowed." }, { status: 400 });
    } else {
      data.image = parsed.data.image;
    }
  }
  if (typeof body.handle === "string") data.handle = body.handle;
  if (parsed.data.themeColors !== undefined)
    data.themeColors = JSON.stringify(parsed.data.themeColors);

  const updated = await prisma.user.update({
    where: { id: user!.id },
    data,
  });

  return NextResponse.json({ user: updated });
}
