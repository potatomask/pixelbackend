import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/worlds/public/[slug] — Get published world data (by world slug or user handle)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Reject invalid slugs (e.g. favicon.ico hitting the catch-all route)
  if (!slug || slug.includes(".")) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  // 1. Try by world slug first
  let world = await prisma.world.findFirst({
    where: { slug },
    select: {
      id: true,
      publishedData: true,
      isPublished: true,
      ownerId: true,
      slug: true,
    },
  });

  // 2. If no world found by slug, try by user handle
  if (!world) {
    const user = await prisma.user.findUnique({
      where: { handle: slug },
      select: { id: true },
    });
    if (user) {
      world = await prisma.world.findFirst({
        where: { ownerId: user.id },
        select: {
          id: true,
          publishedData: true,
          isPublished: true,
          ownerId: true,
          slug: true,
        },
        orderBy: { publishedAt: "desc" },
      });
    }
  }

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  // World exists but has never been saved from editor — nothing to show yet
  if (!world.publishedData) {
    return NextResponse.json({ error: "World is empty", empty: true }, { status: 404 });
  }

  // Get creator profile
  const profile = await prisma.user.findUnique({
    where: { id: world.ownerId },
    select: {
      id: true,
      handle: true,
      displayName: true,
      image: true,
      bio: true,
      themeColors: true,
      tier: true,
    },
  });

  // Build a safe profile object that doesn't leak tier info
  const safeProfile = profile
    ? {
        id: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
        image: profile.image,
        bio: profile.bio,
        themeColors: profile.themeColors ? JSON.parse(profile.themeColors) : null,
        showBranding: profile.tier === "FREE",
      }
    : null;

  // Load global wind config (applies to all worlds)
  const windSetting = await prisma.siteSetting.findUnique({ where: { key: "dev-wind-config" } });
  const windConfig = windSetting?.value ? JSON.parse(windSetting.value) : null;

  const response = NextResponse.json({
    publishedData: JSON.parse(world.publishedData),
    profile: safeProfile,
    slug: world.slug,
    worldId: world.id,
    windConfig,
  });

  // CDN cache
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );

  return response;
}
