import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-utils";
import { createEmptyWorldData } from "@mypixelpage/shared";

const VALID_SOURCES = ["google", "bing", "twitter", "other"] as const;
const VALID_USE_CASES = ["portfolio", "landing_page", "link_in_bio", "other"] as const;

// POST /api/onboarding — Save onboarding answers
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { source, sourceOther, useCase, useCaseOther } = body as {
    source?: string;
    sourceOther?: string;
    useCase?: string;
    useCaseOther?: string;
  };

  if (!source || !VALID_SOURCES.includes(source as any)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }
  if (source === "other" && !sourceOther?.trim()) {
    return NextResponse.json({ error: "Please describe where you found us" }, { status: 400 });
  }
  if (!useCase || !VALID_USE_CASES.includes(useCase as any)) {
    return NextResponse.json({ error: "Invalid useCase" }, { status: 400 });
  }
  if (useCase === "other" && !useCaseOther?.trim()) {
    return NextResponse.json({ error: "Please describe your use case" }, { status: 400 });
  }

  const cleanSourceOther =
    source === "other" && typeof sourceOther === "string"
      ? sourceOther.trim().slice(0, 200)
      : null;

  const cleanUseCaseOther =
    useCase === "other" && typeof useCaseOther === "string"
      ? useCaseOther.trim().slice(0, 200)
      : null;

  await prisma.$transaction([
    prisma.onboarding.upsert({
      where: { userId: user!.id },
      create: {
        userId: user!.id,
        source,
        sourceOther: cleanSourceOther,
        useCase,
        useCaseOther: cleanUseCaseOther,
      },
      update: {
        source,
        sourceOther: cleanSourceOther,
        useCase,
        useCaseOther: cleanUseCaseOther,
      },
    }),
    prisma.user.update({
      where: { id: user!.id },
      data: { onboardedAt: new Date() },
    }),
  ]);

  // Auto-create a world for this user if they don't have one
  const existingWorld = await prisma.world.findFirst({ where: { ownerId: user!.id } });
  if (!existingWorld) {
    const dbUser = await prisma.user.findUnique({ where: { id: user!.id }, select: { handle: true } });
    const slug = dbUser?.handle || user!.id;
    const emptyData = createEmptyWorldData();
    await prisma.world.create({
      data: {
        ownerId: user!.id,
        slug,
        width: emptyData.gridWidth,
        height: emptyData.gridHeight,
        draftData: JSON.stringify(emptyData),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

// GET /api/onboarding — Check if user has completed onboarding
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { onboardedAt: true },
  });

  return NextResponse.json({ onboarded: !!dbUser?.onboardedAt });
}
