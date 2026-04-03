import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-utils";

// GET /api/analytics/summary?worldId=xxx — Get analytics summary
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const worldId = request.nextUrl.searchParams.get("worldId");
  if (!worldId) {
    return NextResponse.json({ error: "worldId required" }, { status: 400 });
  }

  // Verify ownership
  const world = await prisma.world.findFirst({
    where: { id: worldId, ownerId: user!.id },
    select: { id: true },
  });

  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  // Total views
  const totalViews = await prisma.analyticsEvent.count({
    where: { worldId, eventType: "page_view" },
  });

  // Views today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const viewsToday = await prisma.analyticsEvent.count({
    where: {
      worldId,
      eventType: "page_view",
      timestamp: { gte: todayStart },
    },
  });

  // Interaction counts per object
  const interactions = await prisma.analyticsEvent.groupBy({
    by: ["objectId"],
    where: { worldId, eventType: "interaction", objectId: { not: null } },
    _count: { id: true },
  });

  return NextResponse.json({
    totalViews,
    viewsToday,
    interactions: interactions.map((i) => ({
      objectId: i.objectId!,
      count: i._count.id,
    })),
  });
}
