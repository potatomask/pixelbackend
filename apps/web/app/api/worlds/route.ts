import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-utils";
import { CreateWorldSchema, createEmptyWorldData } from "@mypixelpage/shared";

// POST /api/worlds — Create a new world
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const parsed = CreateWorldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Check if user already has a world (one world per user in V1)
  const existing = await prisma.world.findFirst({ where: { ownerId: user!.id } });
  if (existing) {
    return NextResponse.json({ error: "You already have a world. One world per user in V1." }, { status: 409 });
  }

  const { slug, width, height } = parsed.data;
  const draftData = createEmptyWorldData(width, height);

  const world = await prisma.world.create({
    data: {
      ownerId: user!.id,
      slug,
      width,
      height,
      draftData: JSON.stringify(draftData),
    },
  });

  return NextResponse.json({ world: { ...world, draftData } }, { status: 201 });
}
