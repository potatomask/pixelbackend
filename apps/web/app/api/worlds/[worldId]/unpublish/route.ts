import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-utils";

// POST /api/worlds/[worldId]/unpublish — Unpublish the world
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const { worldId } = await params;

  const world = await prisma.world.findFirst({
    where: { id: worldId, ownerId: user!.id },
    select: { id: true },
  });

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  await prisma.world.update({
    where: { id: worldId },
    data: {
      publishedData: null,
      isPublished: false,
      publishedAt: null,
    },
  });

  return NextResponse.json({});
}
