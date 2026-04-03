import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-utils";
import { WorldDataSchema } from "@mypixelpage/shared";

// PUT /api/worlds/[worldId]/draft — Save draft data
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const { worldId } = await params;
  const body = await request.json();

  // Validate draft data
  const parsed = WorldDataSchema.safeParse(body.draftData);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify ownership
  const world = await prisma.world.findFirst({
    where: { id: worldId, ownerId: user!.id },
    select: { id: true },
  });

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const updated = await prisma.world.update({
    where: { id: worldId },
    data: { draftData: JSON.stringify(parsed.data) },
  });

  return NextResponse.json({ updatedAt: updated.updatedAt.toISOString() });
}
