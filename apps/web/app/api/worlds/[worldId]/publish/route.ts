import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-utils";
import { MAX_PUBLISH_RECORDS } from "@mypixelpage/shared";

// POST /api/worlds/[worldId]/publish — Publish the world
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const { worldId } = await params;

  // Verify ownership and get draft
  const world = await prisma.world.findFirst({
    where: { id: worldId, ownerId: user!.id },
  });

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  // Determine version
  const lastRecord = await prisma.publishRecord.findFirst({
    where: { worldId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastRecord?.version ?? 0) + 1;

  const now = new Date();

  // Copy draft to published + create publish record in a transaction
  await prisma.$transaction([
    prisma.world.update({
      where: { id: worldId },
      data: {
        publishedData: world.draftData,
        isPublished: true,
        publishedAt: now,
      },
    }),
    prisma.publishRecord.create({
      data: {
        worldId,
        version: nextVersion,
        data: world.draftData,
      },
    }),
  ]);

  // Prune old records (keep last N)
  const totalRecords = await prisma.publishRecord.count({ where: { worldId } });
  if (totalRecords > MAX_PUBLISH_RECORDS) {
    const oldRecords = await prisma.publishRecord.findMany({
      where: { worldId },
      orderBy: { publishedAt: "asc" },
      take: totalRecords - MAX_PUBLISH_RECORDS,
      select: { id: true },
    });
    if (oldRecords.length > 0) {
      await prisma.publishRecord.deleteMany({
        where: { id: { in: oldRecords.map((r) => r.id) } },
      });
    }
  }

  return NextResponse.json({ publishedAt: now.toISOString(), version: nextVersion });
}
